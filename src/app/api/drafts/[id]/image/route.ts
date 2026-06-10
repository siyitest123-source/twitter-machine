import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getAccount } from "@/lib/accounts";
import { getDb } from "@/lib/db";
import { generateAndStoreImage, IMAGES_DIR } from "@/lib/image";
import { deriveImagePrompt } from "@/lib/image-prompt";
import { drafts } from "@/lib/schema";

const BodySchema = z.object({
  // Optional override — caller can supply a hand-crafted prompt. When absent
  // we ask Claude to derive one from the tweet text + account persona.
  prompt: z.string().min(1).max(2000).optional(),
  imageSize: z
    .enum([
      "square_hd",
      "square",
      "portrait_4_3",
      "portrait_16_9",
      "landscape_4_3",
      "landscape_16_9",
    ])
    .optional(),
});

/** POST /api/drafts/[id]/image — generate (or regenerate) an image for a draft. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/drafts/[id]/image">,
) {
  const { id } = await ctx.params;
  const draftId = Number(id);
  if (!Number.isInteger(draftId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  let body: z.infer<typeof BodySchema> = {};
  try {
    const text = await request.text();
    if (text) body = BodySchema.parse(JSON.parse(text));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "bad body" },
      { status: 400 },
    );
  }

  const db = getDb();
  const [draft] = await db
    .select()
    .from(drafts)
    .where(eq(drafts.id, draftId))
    .limit(1);
  if (!draft) return Response.json({ error: "not found" }, { status: 404 });

  const account = await getAccount(db, draft.accountId);
  if (!account) {
    return Response.json({ error: "account vanished" }, { status: 500 });
  }

  try {
    const prompt =
      body.prompt ??
      (await deriveImagePrompt({
        tweetText: draft.text,
        persona: account.persona,
      }));

    const result = await generateAndStoreImage({
      prompt,
      accountId: account.id,
      draftId: draft.id,
      imageSize: body.imageSize,
    });

    const [updated] = await db
      .update(drafts)
      .set({
        imageUrl: result.url,
        imagePrompt: prompt,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(drafts.id, draft.id))
      .returning();

    return Response.json({
      draft: updated,
      prompt,
      bytes: result.bytes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/drafts/[id]/image — remove the attached image. */
export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/drafts/[id]/image">,
) {
  const { id } = await ctx.params;
  const draftId = Number(id);
  if (!Number.isInteger(draftId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  const db = getDb();
  const [draft] = await db
    .select()
    .from(drafts)
    .where(eq(drafts.id, draftId))
    .limit(1);
  if (!draft) return Response.json({ error: "not found" }, { status: 404 });

  // Best-effort delete the file on disk.
  if (draft.accountId) {
    const fsPath = join(IMAGES_DIR, String(draft.accountId), `${draft.id}.jpg`);
    if (existsSync(fsPath)) {
      try {
        unlinkSync(fsPath);
      } catch {
        /* ignore */
      }
    }
  }

  const [updated] = await db
    .update(drafts)
    .set({
      imageUrl: null,
      imagePrompt: null,
      updatedAt: sql`(unixepoch())`,
    })
    .where(eq(drafts.id, draft.id))
    .returning();

  return Response.json({ draft: updated });
}

