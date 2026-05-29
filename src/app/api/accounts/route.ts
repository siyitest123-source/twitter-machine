import { desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { accounts } from "@/lib/schema";

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(accounts).orderBy(desc(accounts.createdAt));
  return Response.json({ accounts: rows });
}

const PostSchema = z.object({
  handle: z
    .string()
    .min(1)
    .max(64)
    .regex(/^@?[A-Za-z0-9_]{1,15}$/, "must be a valid Twitter handle"),
  displayName: z.string().max(120).optional(),
  persona: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const parsed = PostSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const handle = parsed.data.handle.replace(/^@/, "");
  const db = getDb();
  try {
    const [row] = await db
      .insert(accounts)
      .values({
        handle,
        displayName: parsed.data.displayName ?? null,
        persona: parsed.data.persona ?? null,
      })
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
