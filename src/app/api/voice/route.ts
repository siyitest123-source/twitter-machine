import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { resolveAccountId } from "@/lib/accounts";
import { getDb } from "@/lib/db";
import { voiceSamples } from "@/lib/schema";

export async function GET(request: Request) {
  const db = getDb();
  const url = new URL(request.url);
  const accountId = await resolveAccountId(db, url.searchParams.get("accountId"));
  if (accountId === null) {
    return Response.json({ error: "valid accountId required" }, { status: 400 });
  }
  const rows = await db
    .select()
    .from(voiceSamples)
    .where(eq(voiceSamples.accountId, accountId))
    .orderBy(desc(voiceSamples.createdAt));
  return Response.json({ samples: rows });
}

const PostSchema = z.object({
  accountId: z.number().int().positive(),
  samples: z
    .array(
      z.object({
        text: z.string().min(1).max(4000),
        context: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(500),
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
  const inserted = await db
    .insert(voiceSamples)
    .values(
      parsed.data.samples.map((s) => ({
        accountId,
        text: s.text,
        context: s.context ?? null,
      })),
    )
    .returning();
  return Response.json({ inserted: inserted.length, samples: inserted });
}
