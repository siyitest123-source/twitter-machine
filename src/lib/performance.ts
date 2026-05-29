import { and, desc, eq, gt } from "drizzle-orm";
import type { getDb } from "./db";
import { type Draft, drafts, type VoiceSample } from "./schema";

/**
 * Weighted engagement score. Rewards amplification and conversation over
 * passive likes. Works whether or not impressions were logged.
 *   likes + 2*retweets + 3*replies
 */
export function engagementScore(d: {
  likes: number;
  retweets: number;
  replies: number;
}): number {
  return d.likes + 2 * d.retweets + 3 * d.replies;
}

/** Engagement rate against impressions, as a percentage. Null if no impressions. */
export function engagementRate(d: {
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
}): number | null {
  if (!d.impressions) return null;
  return ((d.likes + d.retweets + d.replies) / d.impressions) * 100;
}

/**
 * Top-performing posted drafts, mapped into voice-sample shape so the
 * generator leans toward what actually worked. Only includes posts with
 * a positive engagement score.
 */
export async function getTopPerformers(
  db: ReturnType<typeof getDb>,
  accountId: number,
  limit = 5,
): Promise<VoiceSample[]> {
  const posted = await db
    .select()
    .from(drafts)
    .where(
      and(
        eq(drafts.accountId, accountId),
        eq(drafts.status, "posted"),
        gt(drafts.metricsUpdatedAt, 0),
      ),
    )
    .orderBy(desc(drafts.metricsUpdatedAt))
    .limit(200);

  const ranked = posted
    .filter((d) => engagementScore(d) > 0)
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, limit);

  return ranked.map(
    (d: Draft): VoiceSample => ({
      id: -d.id, // negative to avoid colliding with real voice_samples ids
      accountId: d.accountId,
      text: d.text,
      context: `high-performer (${engagementScore(d)} pts)`,
      createdAt: d.postedAt ?? d.createdAt,
    }),
  );
}
