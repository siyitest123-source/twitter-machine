import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { accounts } from "@/lib/schema";
import { testTypefullyKey } from "@/lib/typefully";

const BodySchema = z.object({
  apiKey: z.string().min(1).max(500).optional(),
});

/**
 * POST /api/accounts/[id]/typefully/test
 * - Body { apiKey } → tests the provided key without saving.
 * - Empty body → tests the key currently stored on the account.
 *
 * Returns { ok: true } on success or { error } on failure.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/accounts/[id]/typefully/test">,
) {
  const { id } = await ctx.params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  let apiKey: string | undefined;
  try {
    const text = await request.text();
    if (text) apiKey = BodySchema.parse(JSON.parse(text)).apiKey;
  } catch {
    /* no body is fine */
  }

  if (!apiKey) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    apiKey = row?.typefullyApiKey ?? undefined;
  }

  if (!apiKey) {
    return Response.json(
      { error: "no API key to test (none provided, none saved)" },
      { status: 400 },
    );
  }

  try {
    const result = await testTypefullyKey(apiKey);
    return Response.json({ ok: true, socialSets: result.socialSets });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
