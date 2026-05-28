import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { targetAccounts } from "@/lib/schema";

const PatchSchema = z.object({
  notes: z.string().max(500).nullable().optional(),
  engagementMode: z.enum(["engage", "monitor", "amplify"]).optional(),
});

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/targets/[id]">,
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
  const db = getDb();
  const [row] = await db
    .update(targetAccounts)
    .set(parsed.data)
    .where(eq(targetAccounts.id, numId))
    .returning();
  return Response.json({ target: row });
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/targets/[id]">,
) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const db = getDb();
  await db.delete(targetAccounts).where(eq(targetAccounts.id, numId));
  return Response.json({ ok: true });
}
