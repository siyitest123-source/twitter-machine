/**
 * Resolve a public tweet URL to its text via Twitter's syndication endpoint
 * (cdn.syndication.twimg.com) — the same anonymous, no-auth endpoint that
 * powers embedded-tweet widgets. Read-only, nothing tied to the user's
 * account.
 *
 * Caveats (surfaced to the user in the UI):
 * - Unofficial endpoint; Twitter can change/close it without notice.
 * - Public tweets only (protected/deleted return nothing).
 *
 * Long-form ("note") tweets: the truncated `text` is replaced by the full
 * `note_tweet.text` when present.
 */

const TWEET_ID_RE = /(?:twitter\.com|x\.com)\/[^/]+\/status(?:es)?\/(\d+)/i;

export function extractTweetId(input: string): string | null {
  const trimmed = input.trim();
  // Bare numeric id
  if (/^\d{5,25}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(TWEET_ID_RE);
  return m ? m[1] : null;
}

type SyndicationTweet = {
  text?: string;
  note_tweet?: { text?: string };
  user?: { screen_name?: string };
  created_at?: string;
};

export type ResolvedTweet = {
  id: string;
  text: string;
  handle: string | null;
};

/**
 * The endpoint expects a `token` param; any value works but it must be present.
 * Twitter derives a real token from the id client-side; a constant is fine for
 * our low-volume reads.
 */
function tokenFor(id: string): string {
  // Mimic the lightweight token the embed widget uses. Constant is accepted.
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/[^a-z0-9]/g, "").slice(0, 10) || "a";
}

export async function resolveTweet(idOrUrl: string): Promise<ResolvedTweet> {
  const id = extractTweetId(idOrUrl);
  if (!id) {
    throw new Error(`Not a tweet URL: ${idOrUrl.slice(0, 80)}`);
  }

  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${tokenFor(id)}&lang=en`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "application/json",
    },
  });

  if (res.status === 404) {
    throw new Error(`Tweet ${id} not found (deleted, protected, or wrong URL)`);
  }
  if (!res.ok) {
    throw new Error(`Syndication endpoint ${res.status} for tweet ${id}`);
  }

  const data = (await res.json()) as SyndicationTweet;
  const text = (data.note_tweet?.text ?? data.text ?? "").trim();
  if (!text) {
    throw new Error(`Tweet ${id} returned no text`);
  }

  return {
    id,
    text,
    handle: data.user?.screen_name ?? null,
  };
}

/** Resolve many; returns successes + per-line failures so the UI can report both. */
export async function resolveTweets(
  inputs: string[],
): Promise<{ resolved: ResolvedTweet[]; failed: { input: string; error: string }[] }> {
  const resolved: ResolvedTweet[] = [];
  const failed: { input: string; error: string }[] = [];

  // Sequential with a tiny gap — we're being a polite anonymous reader, not
  // hammering. Volumes here are tens of tweets, not thousands.
  for (const input of inputs) {
    try {
      resolved.push(await resolveTweet(input));
    } catch (e) {
      failed.push({
        input,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { resolved, failed };
}
