import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { resolveAccountId } from "@/lib/accounts";
import { getDb } from "@/lib/db";
import { targetAccounts } from "@/lib/schema";

export async function GET(request: Request) {
  const db = getDb();
  const url = new URL(request.url);
  const accountId = await resolveAccountId(db, url.searchParams.get("accountId"));
  if (accountId === null) {
    return Response.json({ error: "valid accountId required" }, { status: 400 });
  }
  const rows = await db
    .select()
    .from(targetAccounts)
    .where(eq(targetAccounts.accountId, accountId))
    .orderBy(desc(targetAccounts.createdAt));
  return Response.json({ targets: rows });
}

const PostSchema = z.object({
  accountId: z.number().int().positive(),
  handle: z
    .string()
    .min(1)
    .max(64)
    .regex(/^@?[A-Za-z0-9_]{1,15}$/, "must be a valid Twitter handle"),
  notes: z.string().max(500).optional(),
  engagementMode: z.enum(["engage", "monitor", "amplify"]).optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const db = getDb();
  const accountId = await resolveAccountId(db, parsed.data.accountId);
  if (accountId === null) {
    return Response.json({ error: "unknown accountId" }, { status: 400 });
  }
  const handle = parsed.data.handle.replace(/^@/, "");
  try {
    const [row] = await db
      .insert(targetAccounts)
      .values({
        accountId,
        handle,
        notes: parsed.data.notes ?? null,
        engagementMode: parsed.data.engagementMode ?? "engage",
      })
      .returning();
    return Response.json({ target: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) {
      return Response.json(
        { error: "this account already tracks that handle" },
        { status: 409 },
      );
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
