import { and, eq, inArray } from "drizzle-orm";
import { getAccount } from "@/lib/accounts";
import { generateText } from "@/lib/claude";
import { getDb } from "@/lib/db";
import {
  discoveredTweets,
  targetAccounts,
  voiceSamples,
  type VoiceSample,
} from "@/lib/schema";
import { fetchRecentTweets, type TimelineTweet } from "@/lib/timeline-fetch";

const RELEVANCE_THRESHOLD = 5; // store tweets the model rates >= this
const MAX_TWEETS_PER_SCAN = 25; // cap Claude work per scan
const PER_HANDLE_MAX = 10;
const SINCE_HOURS = 24;

export type ScanSummary = {
  accountId: number;
  handlesScanned: number;
  tweetsFetched: number;
  newCandidates: number;
  stored: number;
  fetchErrors: { handle: string; error: string }[];
};

type Triage = {
  i: number;
  relevance: number;
  reply: string;
  qrt: string;
};

function pickSamples(samples: VoiceSample[], k = 12): VoiceSample[] {
  if (samples.length <= k) return samples;
  return [...samples].sort(() => Math.random() - 0.5).slice(0, k);
}

function extractJsonArray(text: string): Triage[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("model did not return a JSON array");
  return JSON.parse(text.slice(start, end + 1)) as Triage[];
}

/**
 * Scan an account's engage/amplify targets for recent tweets worth engaging
 * with. Fetches timelines, dedupes against what's already been discovered,
 * runs one batched Claude triage call (relevance + reply + QRT in the
 * account's voice), and stores the keepers as `discovered_tweets` rows.
 */
export async function runScan(accountId: number): Promise<ScanSummary> {
  const db = getDb();
  const account = await getAccount(db, accountId);
  if (!account) throw new Error("unknown account");

  const targets = await db
    .select()
    .from(targetAccounts)
    .where(eq(targetAccounts.accountId, accountId));

  const engageTargets = targets.filter(
    (t) => t.engagementMode === "engage" || t.engagementMode === "amplify",
  );

  const summary: ScanSummary = {
    accountId,
    handlesScanned: 0,
    tweetsFetched: 0,
    newCandidates: 0,
    stored: 0,
    fetchErrors: [],
  };

  if (engageTargets.length === 0) return summary;

  // 1. Fetch timelines — sequential with polite spacing so we don't trip
  //    the syndication endpoint's burst rate limit.
  const fetched: (TimelineTweet & { handle: string })[] = [];
  for (let i = 0; i < engageTargets.length; i++) {
    const t = engageTargets[i];
    try {
      const tweets = await fetchRecentTweets(t.handle, {
        sinceHours: SINCE_HOURS,
        max: PER_HANDLE_MAX,
      });
      for (const tw of tweets) fetched.push({ ...tw, handle: t.handle });
      summary.handlesScanned += 1;
    } catch (e) {
      summary.fetchErrors.push({
        handle: t.handle,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    if (i < engageTargets.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  summary.tweetsFetched = fetched.length;
  if (fetched.length === 0) return summary;

  // 2. Dedupe against already-discovered (any status, so we don't resurface
  //    dismissed ones either).
  const ids = fetched.map((t) => t.id);
  const existing = await db
    .select({ sourceTweetId: discoveredTweets.sourceTweetId })
    .from(discoveredTweets)
    .where(
      and(
        eq(discoveredTweets.accountId, accountId),
        inArray(discoveredTweets.sourceTweetId, ids),
      ),
    );
  const seen = new Set(existing.map((e) => e.sourceTweetId));
  let candidates = fetched.filter((t) => !seen.has(t.id));

  // Prefer higher-engagement tweets when over the cap.
  candidates.sort((a, b) => b.likes + b.retweets - (a.likes + a.retweets));
  candidates = candidates.slice(0, MAX_TWEETS_PER_SCAN);
  summary.newCandidates = candidates.length;
  if (candidates.length === 0) return summary;

  // 3. Voice pool + one batched triage call.
  const samples = await db
    .select()
    .from(voiceSamples)
    .where(eq(voiceSamples.accountId, accountId));
  const voicePool = pickSamples(samples, 12);
  const voiceBlock = voicePool.length
    ? voicePool.map((s) => `- ${s.text}`).join("\n")
    : "(no voice samples — write sharp, opinionated, crypto-native, no cliches)";

  const personaBlock = account.persona?.trim()
    ? `\nAccount persona: ${account.persona.trim()}\n`
    : "";

  const system = `You triage tweets from accounts a crypto/DeFi marketer follows, deciding which are worth engaging with and drafting the engagement in the user's exact voice.
${personaBlock}
Voice samples (match this style — cadence, vocabulary, capitalization):
${voiceBlock}

Rules:
- relevance 0-10: how worth engaging this tweet is for THIS account (high = on-topic, sparks a good take, timely; low = off-topic, generic, or a scam/shill).
- reply: a short reply in the user's voice that adds something (a take, counterpoint, data). Never "great post". Empty string if not worth replying.
- qrt: a quote-retweet take in the user's voice. Empty string if not worth quoting.
- Never engage with scams, rugpulls, obvious shills, or contract-address spam — give those relevance 0.
- No hashtags/emojis unless the voice samples use them.`;

  const list = candidates
    .map((t, i) => `[${i}] @${t.handle}: ${t.text}`)
    .join("\n\n");
  const user = `Tweets to triage:

${list}

Respond ONLY with a JSON array, one object per tweet index:
[{ "i": 0, "relevance": 0-10, "reply": "...", "qrt": "..." }]`;

  let triaged: Triage[];
  try {
    const out = await generateText({ system, user, maxTurns: 1 });
    triaged = extractJsonArray(out);
  } catch (e) {
    throw new Error(
      `triage failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // 4. Store keepers.
  const byIndex = new Map(triaged.map((t) => [t.i, t]));
  const rows = candidates
    .map((c, i) => ({ c, t: byIndex.get(i) }))
    .filter(
      (x): x is { c: (typeof candidates)[number]; t: Triage } =>
        !!x.t && (x.t.relevance ?? 0) >= RELEVANCE_THRESHOLD,
    )
    .map(({ c, t }) => ({
      accountId,
      sourceTweetId: c.id,
      sourceHandle: c.handle,
      sourceUrl: c.url,
      sourceText: c.text,
      tweetCreatedAt: c.createdAt || null,
      likes: c.likes,
      retweets: c.retweets,
      relevance: Math.max(0, Math.min(10, t.relevance ?? 0)),
      replyDraft: t.reply?.trim() || null,
      qrtDraft: t.qrt?.trim() || null,
      status: "new" as const,
    }));

  if (rows.length > 0) {
    await db.insert(discoveredTweets).values(rows).onConflictDoNothing();
    summary.stored = rows.length;
  }

  return summary;
}
