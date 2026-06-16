import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { discoveredTweets, drafts } from "@/lib/schema";

const PatchSchema = z.object({
  // "dismiss" → hide it. "save" → create a draft in the queue from one of the
  // suggested engagements, then mark this discovery actioned.
  action: z.enum(["dismiss", "save"]),
  kind: z.enum(["reply", "qrt"]).optional(), // required when action=save
  text: z.string().min(1).max(4000).optional(), // optional edited text override
});

/** PATCH /api/discover/[id] — dismiss a discovered tweet or save an engagement to the queue. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/discover/[id]">,
) {
  const { id } = await ctx.params;
  const discId = Number(id);
  if (!Number.isInteger(discId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = getDb();
  const [disc] = await db
    .select()
    .from(discoveredTweets)
    .where(eq(discoveredTweets.id, discId))
    .limit(1);
  if (!disc) return Response.json({ error: "not found" }, { status: 404 });

  if (parsed.data.action === "dismiss") {
    const [row] = await db
      .update(discoveredTweets)
      .set({ status: "dismissed" })
      .where(eq(discoveredTweets.id, discId))
      .returning();
    return Response.json({ discovered: row });
  }

  // action === "save" → create a draft from the chosen engagement.
  const kind = parsed.data.kind ?? "reply";
  const text =
    parsed.data.text?.trim() ||
    (kind === "reply" ? disc.replyDraft : disc.qrtDraft) ||
    "";
  if (!text) {
    return Response.json(
      { error: `no ${kind} draft available to save` },
      { status: 400 },
    );
  }

  const [draft] = await db
    .insert(drafts)
    .values({
      accountId: disc.accountId,
      type: kind === "reply" ? "reply" : "qrt",
      text,
      sourceUrl: disc.sourceUrl,
      sourceText: disc.sourceText,
      sourceHandle: disc.sourceHandle,
      angle: `from discover · @${disc.sourceHandle ?? "?"}`,
      status: "pending",
    })
    .returning();

  const [row] = await db
    .update(discoveredTweets)
    .set({ status: "actioned" })
    .where(eq(discoveredTweets.id, discId))
    .returning();

  return Response.json({ discovered: row, draft });
}

/** DELETE /api/discover/[id] — remove a discovered tweet entirely. */
export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/discover/[id]">,
) {
  const { id } = await ctx.params;
  const discId = Number(id);
  if (!Number.isInteger(discId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const db = getDb();
  await db.delete(discoveredTweets).where(eq(discoveredTweets.id, discId));
  return Response.json({ ok: true });
}
