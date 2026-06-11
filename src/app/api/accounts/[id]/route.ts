import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { accounts, drafts, targetAccounts, voiceSamples } from "@/lib/schema";

const PatchSchema = z.object({
  handle: z
    .string()
    .min(1)
    .max(64)
    .regex(/^@?[A-Za-z0-9_]{1,15}$/, "must be a valid Twitter handle")
    .optional(),
  displayName: z.string().max(120).nullable().optional(),
  persona: z.string().max(2000).nullable().optional(),
  typefullyApiKey: z.string().max(500).nullable().optional(),
});

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/accounts/[id]">,
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
  const data = { ...parsed.data };
  if (data.handle) data.handle = data.handle.replace(/^@/, "");
  const db = getDb();
  try {
    const [row] = await db
      .update(accounts)
      .set(data)
      .where(eq(accounts.id, numId))
      .returning();
    return Response.json({ account: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) {
      return Response.json(
        { error: "an account with that handle already exists" },
        { status: 409 },
      );
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/accounts/[id]">,
) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const db = getDb();
  // Cascade: remove all of this account's data, then the account.
  await db.delete(voiceSamples).where(eq(voiceSamples.accountId, numId));
  await db.delete(targetAccounts).where(eq(targetAccounts.accountId, numId));
  await db.delete(drafts).where(eq(drafts.accountId, numId));
  await db.delete(accounts).where(eq(accounts.id, numId));
  return Response.json({ ok: true });
}
