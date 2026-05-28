import { desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { targetAccounts } from "@/lib/schema";

export async function GET() {
  const db = getDb();
  const rows = await db
    .select()
    .from(targetAccounts)
    .orderBy(desc(targetAccounts.createdAt));
  return Response.json({ targets: rows });
}

const PostSchema = z.object({
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
  const handle = parsed.data.handle.replace(/^@/, "");
  const db = getDb();
  try {
    const [row] = await db
      .insert(targetAccounts)
      .values({
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
        { error: "handle already exists" },
        { status: 409 },
      );
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
