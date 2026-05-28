import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { drafts } from "@/lib/schema";

const PatchSchema = z.object({
  text: z.string().min(1).max(4000).optional(),
  status: z.enum(["pending", "approved", "rejected", "posted"]).optional(),
  angle: z.string().max(120).nullable().optional(),
  scheduledFor: z.number().int().nullable().optional(),
  postedAt: z.number().int().nullable().optional(),
  impressions: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
  retweets: z.number().int().min(0).optional(),
  replies: z.number().int().min(0).optional(),
});

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/drafts/[id]">,
) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const update: Record<string, unknown> = {
    ...data,
    updatedAt: sql`(unixepoch())`,
  };

  // When a draft is first marked posted, stamp posted_at (unless explicitly set).
  if (data.status === "posted" && data.postedAt === undefined) {
    update.postedAt = sql`(unixepoch())`;
  }

  // Touch metrics_updated_at whenever any metric changes.
  const metricKeys = ["impressions", "likes", "retweets", "replies"] as const;
  if (metricKeys.some((k) => data[k] !== undefined)) {
    update.metricsUpdatedAt = sql`(unixepoch())`;
  }

  const db = getDb();
  const [row] = await db
    .update(drafts)
    .set(update)
    .where(eq(drafts.id, numId))
    .returning();
  return Response.json({ draft: row });
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/drafts/[id]">,
) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const db = getDb();
  await db.delete(drafts).where(eq(drafts.id, numId));
  return Response.json({ ok: true });
}
