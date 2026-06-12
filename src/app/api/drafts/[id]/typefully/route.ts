import { eq, sql } from "drizzle-orm";
import { getAccount } from "@/lib/accounts";
import { getDb } from "@/lib/db";
import { drafts } from "@/lib/schema";
import { sendToTypefully } from "@/lib/typefully";

/**
 * POST /api/drafts/[id]/typefully — send a saved draft to Typefully so the
 * team can review/schedule there. If the draft has scheduledFor set (from
 * Calendar / Weekly Plan), we forward that as Typefully's schedule-date.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/drafts/[id]/typefully">,
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
  if (!draft) {
    return Response.json({ error: "draft not found" }, { status: 404 });
  }

  const account = await getAccount(db, draft.accountId);
  if (!account) {
    return Response.json({ error: "account vanished" }, { status: 500 });
  }
  if (!account.typefullyApiKey) {
    return Response.json(
      {
        error:
          "No Typefully API key on this account. Go to Accounts and paste your Typefully Pro API key (Typefully → Settings → API).",
      },
      { status: 400 },
    );
  }

  const threadParts: string[] = draft.threadParts
    ? (() => {
        try {
          return JSON.parse(draft.threadParts) as string[];
        } catch {
          return [];
        }
      })()
    : [];

  const scheduleDateISO = draft.scheduledFor
    ? new Date(draft.scheduledFor * 1000).toISOString()
    : null;

  try {
    const result = await sendToTypefully({
      apiKey: account.typefullyApiKey,
      text: draft.text,
      threadParts,
      scheduleDateISO,
      handle: account.handle,
      replyToUrl:
        draft.type === "reply" && draft.sourceUrl ? draft.sourceUrl : null,
    });

    const [updated] = await db
      .update(drafts)
      .set({
        typefullyDraftId: result.typefullyDraftId,
        typefullyUrl: result.typefullyUrl,
        typefullySentAt: sql`(unixepoch())`,
        // Bump status to approved if it wasn't already — drafts sent to
        // Typefully are by definition approved-by-you for team review.
        status: draft.status === "pending" ? "approved" : draft.status,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(drafts.id, draft.id))
      .returning();

    return Response.json({ draft: updated, typefully: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
