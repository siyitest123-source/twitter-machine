import { desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { voiceSamples } from "@/lib/schema";

export async function GET() {
  const db = getDb();
  const rows = await db
    .select()
    .from(voiceSamples)
    .orderBy(desc(voiceSamples.createdAt));
  return Response.json({ samples: rows });
}

const PostSchema = z.object({
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
  const inserted = await db
    .insert(voiceSamples)
    .values(
      parsed.data.samples.map((s) => ({
        text: s.text,
        context: s.context ?? null,
      })),
    )
    .returning();
  return Response.json({ inserted: inserted.length, samples: inserted });
}
