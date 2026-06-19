/**
 * Fetch a public account's recent tweets via Twitter's syndication
 * timeline-profile endpoint — the anonymous, no-auth feed that powers
 * embedded profile-timeline widgets. Read-only, nothing tied to the user.
 *
 * Same caveats as tweet-fetch.ts, more so: unofficial, can change/close
 * without notice, public accounts only. This is the engine behind
 * auto-Discover; if it breaks, manual paste in Discover still works.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

export type TimelineTweet = {
  id: string;
  text: string;
  createdAt: number; // unix seconds
  likes: number;
  retweets: number;
  url: string;
};

// In-memory cache of successful fetches, keyed by screen name. A re-scan of
// the same handle within the TTL returns instantly without touching the
// endpoint — the main defense against tripping its burst rate limit when you
// scan repeatedly. The launchd server is long-lived so this persists between
// requests; it resets on restart (fine — it's only a throttle shield).
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const cache = new Map<string, { at: number; tweets: TimelineTweet[] }>();

type RawTweet = {
  id_str?: string;
  full_text?: string;
  text?: string;
  note_tweet?: { text?: string };
  created_at?: string; // "Wed Sep 11 19:31:57 +0000 2024"
  favorite_count?: number;
  retweet_count?: number;
  in_reply_to_status_id_str?: string;
  retweeted_status?: unknown;
  user?: { screen_name?: string };
};

function findFirstTweet(o: unknown): RawTweet | null {
  if (o && typeof o === "object") {
    const obj = o as Record<string, unknown>;
    if (typeof obj.full_text === "string" && typeof obj.created_at === "string") {
      return obj as RawTweet;
    }
    for (const v of Object.values(obj)) {
      const r = findFirstTweet(v);
      if (r) return r;
    }
  } else if (Array.isArray(o)) {
    for (const v of o) {
      const r = findFirstTweet(v);
      if (r) return r;
    }
  }
  return null;
}

/**
 * Fetch recent original tweets for a handle.
 * @param handle  screen name, with or without leading @
 * @param opts.sinceHours  only return tweets newer than this (default 24)
 * @param opts.includeReplies  keep @-replies (default false — we want original content)
 * @param opts.max  cap returned tweets (default 25)
 */
export async function fetchRecentTweets(
  handle: string,
  opts: { sinceHours?: number; includeReplies?: boolean; max?: number } = {},
): Promise<TimelineTweet[]> {
  const screen = handle.replace(/^@/, "").trim();
  if (!/^[A-Za-z0-9_]{1,15}$/.test(screen)) {
    throw new Error(`Invalid handle: ${handle}`);
  }
  const sinceHours = opts.sinceHours ?? 24;
  const max = opts.max ?? 25;
  const cutoff = Date.now() / 1000 - sinceHours * 3600;

  // Cache hit → skip the endpoint entirely.
  const cached = cache.get(screen.toLowerCase());
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.tweets
      .filter((t) => !t.createdAt || t.createdAt >= cutoff)
      .slice(0, max);
  }

  const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${screen}?showReplies=false&lang=en`;

  // The syndication endpoint rate-limits bursts (429). Retry once with a
  // short backoff — fine for a low-frequency daily scan.
  // Each request gets a hard 10s timeout via AbortController — without it a
  // throttled/slow response can hold the connection open indefinitely and
  // stall the whole scan. On 429, retry with bounded backoff.
  async function timedFetch(): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      return await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html" },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  const backoffsMs = [4000, 10000]; // 2 retries; worst case ~44s/handle
  let res: Response;
  try {
    res = await timedFetch();
    for (let i = 0; res.status === 429 && i < backoffsMs.length; i++) {
      await new Promise((r) => setTimeout(r, backoffsMs[i]));
      res = await timedFetch();
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`@${screen}: timed out (endpoint slow or throttled)`);
    }
    throw e;
  }
  if (res.status === 429) {
    throw new Error(
      `@${screen}: rate-limited by Twitter's public endpoint — try again in a few minutes`,
    );
  }
  if (!res.ok) {
    throw new Error(`timeline ${res.status} for @${screen}`);
  }
  const html = await res.text();
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!m) {
    throw new Error(`@${screen}: no timeline data (protected, suspended, or empty)`);
  }

  let entries: unknown[] = [];
  try {
    const data = JSON.parse(m[1]) as {
      props?: { pageProps?: { timeline?: { entries?: unknown[] } } };
    };
    entries = data.props?.pageProps?.timeline?.entries ?? [];
  } catch {
    throw new Error(`@${screen}: timeline data could not be parsed`);
  }

  // Collect ALL original tweets (no cutoff/max cap) so the cache can serve
  // any window; filtering happens on the way out and on cache hits.
  const all: TimelineTweet[] = [];
  for (const entry of entries) {
    const t = findFirstTweet(entry);
    if (!t || !t.id_str) continue;
    if (t.retweeted_status) continue; // skip pure retweets
    if (!opts.includeReplies && t.in_reply_to_status_id_str) continue;

    const text = (t.note_tweet?.text ?? t.full_text ?? t.text ?? "").trim();
    if (!text) continue;

    const createdAt = t.created_at ? Date.parse(t.created_at) / 1000 : 0;
    all.push({
      id: t.id_str,
      text,
      createdAt: Math.floor(createdAt),
      likes: t.favorite_count ?? 0,
      retweets: t.retweet_count ?? 0,
      url: `https://x.com/${screen}/status/${t.id_str}`,
    });
  }

  cache.set(screen.toLowerCase(), { at: Date.now(), tweets: all });

  return all
    .filter((t) => !t.createdAt || t.createdAt >= cutoff)
    .slice(0, max);
}
