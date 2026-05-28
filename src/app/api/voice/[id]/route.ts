import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { voiceSamples } from "@/lib/schema";

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/voice/[id]">,
) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const db = getDb();
  await db.delete(voiceSamples).where(eq(voiceSamples.id, numId));
  return Response.json({ ok: true });
}
