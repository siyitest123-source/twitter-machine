/**
 * Typefully integration. Sends a draft (and its thread continuation if any)
 * to Typefully so teammates can review/comment/schedule there before
 * Typefully publishes to X on their side.
 *
 * Docs: https://typefully.com/api (requires Typefully Pro for API access).
 * Auth: X-API-KEY header.
 *
 * Threads: Typefully uses `\n\n\n\n` (four newlines) as the tweet separator
 * inside a single `content` string. The Typefully UI then renders it as a
 * thread with each tweet editable separately.
 */

const TYPEFULLY_DRAFTS_URL = "https://api.typefully.com/v1/drafts/";

type TypefullyDraftResponse = {
  id?: string | number;
  share_url?: string;
  url?: string;
  scheduled_at?: string | null;
  // many other fields — only pulling what we need
};

export type SendArgs = {
  apiKey: string;
  text: string; // lead tweet (for thread) or the whole tweet (for single)
  threadParts?: string[]; // continuation tweets, in order
  scheduleDateISO?: string | null; // optional ISO 8601; null/undef = leave unscheduled
  threadify?: boolean; // let Typefully auto-split; only useful for non-thread long content
};

export type SendResult = {
  typefullyDraftId: string;
  typefullyUrl: string;
  scheduledAt: string | null;
};

function buildContent(text: string, threadParts?: string[]): string {
  if (!threadParts?.length) return text;
  // Typefully threads: four newlines between tweets.
  return [text, ...threadParts].join("\n\n\n\n");
}

/** Create a draft in Typefully. */
export async function sendToTypefully(args: SendArgs): Promise<SendResult> {
  if (!args.apiKey || args.apiKey.trim().length === 0) {
    throw new Error("Typefully API key missing");
  }

  const body: Record<string, unknown> = {
    content: buildContent(args.text, args.threadParts),
  };
  if (args.scheduleDateISO) {
    body["schedule-date"] = args.scheduleDateISO;
  }
  if (args.threadify) body.threadify = true;

  const res = await fetch(TYPEFULLY_DRAFTS_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": args.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Typefully rejected the API key (401/403). Re-copy from typefully.com → Settings → API.",
      );
    }
    throw new Error(`Typefully ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as TypefullyDraftResponse;
  const id = data.id != null ? String(data.id) : "";
  const url = data.share_url ?? data.url ?? "";
  if (!id || !url) {
    throw new Error(
      "Typefully responded OK but without an id/url — API may have changed.",
    );
  }

  return {
    typefullyDraftId: id,
    typefullyUrl: url,
    scheduledAt: data.scheduled_at ?? null,
  };
}

/**
 * Quick "Test connection" probe: tries to list drafts (HEAD/GET) just to
 * verify the API key is valid. Returns true on 200, throws otherwise.
 *
 * Note: not every Typefully account has a GET endpoint enabled — fallback
 * is to attempt a no-op create. Here we do a lightweight HEAD on the
 * recently-scheduled feed which most accounts have.
 */
export async function testTypefullyKey(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("API key required");
  }
  // Use the recently-scheduled endpoint as a probe. Many Typefully Pro
  // accounts have it; if not we still surface the auth result clearly.
  const res = await fetch(
    "https://api.typefully.com/v1/drafts/recently-scheduled/",
    {
      headers: { "X-API-KEY": apiKey },
    },
  );
  if (res.ok) return true;
  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid API key (Typefully returned 401/403).");
  }
  // Treat other non-OK statuses as connectivity issues but flag the code.
  throw new Error(`Typefully responded ${res.status} — key may still be valid but the probe failed.`);
}
