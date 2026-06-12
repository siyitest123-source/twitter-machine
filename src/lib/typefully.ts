/**
 * Typefully integration (API v2). Sends a draft (and its thread continuation
 * if any) to Typefully so teammates can review/comment/schedule there before
 * Typefully publishes to X on their side.
 *
 * Docs: https://typefully.com/docs/api
 * Auth: `Authorization: Bearer <key>` (the old v1 X-API-KEY header is dead —
 * sending it gets you a 403 even with a valid key).
 *
 * v2 model: drafts live under a "social set" (one per connected brand /
 * X account). So a send is two steps: resolve the social set, then
 * POST /v2/social-sets/{id}/drafts with a platforms.x.posts[] array —
 * one entry per tweet for threads.
 */

const BASE = "https://api.typefully.com/v2";

/** Strip whitespace, quotes, and an accidental "Bearer " prefix from pasted keys. */
export function normalizeApiKey(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${normalizeApiKey(apiKey)}`,
    "Content-Type": "application/json",
  };
}

type SocialSet = {
  id: number | string;
  // The docs don't pin the rest of the shape; name/username fields vary.
  [k: string]: unknown;
};

type SocialSetListResponse = {
  results?: SocialSet[];
  count?: number;
};

type DraftResponse = {
  id?: number | string;
  share_url?: string | null;
  private_url?: string | null;
  status?: string;
  [k: string]: unknown;
};

async function parseError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { error?: { message?: string } };
    if (j.error?.message) return j.error.message;
  } catch {
    /* not json */
  }
  return text.slice(0, 300);
}

/** List the social sets (accounts) this API key can access. Also serves as the key test. */
export async function listSocialSets(apiKey: string): Promise<SocialSet[]> {
  const res = await fetch(`${BASE}/social-sets?limit=50`, {
    headers: authHeaders(apiKey),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "Typefully rejected the API key (401/403). Re-copy it from typefully.com → Settings → API. Paste just the key — no 'Bearer ' prefix needed.",
    );
  }
  if (!res.ok) {
    throw new Error(`Typefully ${res.status}: ${await parseError(res)}`);
  }
  const data = (await res.json()) as SocialSetListResponse;
  return data.results ?? [];
}

/**
 * Pick the social set to post into. If the workspace has several, prefer one
 * whose name/username matches the account handle; otherwise use the first.
 */
function pickSocialSet(sets: SocialSet[], handle?: string): SocialSet {
  if (sets.length === 0) {
    throw new Error(
      "This Typefully key has no social sets (connected accounts). Connect your X account in Typefully first.",
    );
  }
  if (handle && sets.length > 1) {
    const h = handle.replace(/^@/, "").toLowerCase();
    const match = sets.find((s) =>
      Object.values(s).some(
        (v) => typeof v === "string" && v.replace(/^@/, "").toLowerCase() === h,
      ),
    );
    if (match) return match;
  }
  return sets[0];
}

export type SendArgs = {
  apiKey: string;
  text: string; // lead tweet (or the whole tweet for singles)
  threadParts?: string[]; // continuation tweets, in order
  scheduleDateISO?: string | null; // ISO 8601 with timezone; null/undef = plain draft
  handle?: string; // local account handle, used to pick among multiple social sets
  replyToUrl?: string | null; // for reply drafts: the tweet being replied to
};

export type SendResult = {
  typefullyDraftId: string;
  typefullyUrl: string;
  socialSetId: string;
  status: string | null;
};

/** Create a draft in Typefully (API v2). */
export async function sendToTypefully(args: SendArgs): Promise<SendResult> {
  const apiKey = normalizeApiKey(args.apiKey ?? "");
  if (!apiKey) throw new Error("Typefully API key missing");

  const sets = await listSocialSets(apiKey);
  const set = pickSocialSet(sets, args.handle);

  const posts = [args.text, ...(args.threadParts ?? [])].map((text) => ({
    text,
  }));

  const xPlatform: Record<string, unknown> = { enabled: true, posts };
  if (args.replyToUrl) {
    xPlatform.settings = { reply_to_url: args.replyToUrl };
  }

  const body: Record<string, unknown> = {
    platforms: { x: xPlatform },
  };
  if (args.scheduleDateISO) {
    body.publish_at = args.scheduleDateISO; // ISO 8601 with timezone
  }

  const res = await fetch(`${BASE}/social-sets/${set.id}/drafts`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "Typefully rejected the API key (401/403) when creating the draft. The key may lack WRITE access for this social set.",
    );
  }
  if (!res.ok) {
    throw new Error(`Typefully ${res.status}: ${await parseError(res)}`);
  }

  const data = (await res.json()) as DraftResponse;
  const id = data.id != null ? String(data.id) : "";
  const url = data.private_url ?? data.share_url ?? "";
  if (!id) {
    throw new Error(
      "Typefully responded OK but without a draft id — API may have changed.",
    );
  }

  return {
    typefullyDraftId: id,
    typefullyUrl: url || `https://typefully.com/?d=${id}`,
    socialSetId: String(set.id),
    status: data.status ?? null,
  };
}

/**
 * "Test connection": list social sets. Validates the key AND tells the user
 * which connected accounts the key can post to.
 */
export async function testTypefullyKey(
  apiKey: string,
): Promise<{ ok: true; socialSets: number }> {
  const sets = await listSocialSets(apiKey);
  return { ok: true, socialSets: sets.length };
}
