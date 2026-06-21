import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAccount } from "@/lib/accounts";
import { generateText } from "@/lib/claude";
import { extractJson } from "@/lib/extract-json";
import { getDb } from "@/lib/db";
import { buildDiscoveryPrompt, type Narrative } from "@/lib/prompts";
import { drafts, voiceSamples } from "@/lib/schema";

const BodySchema = z.object({
  accountId: z.number().int().positive(),
  tweets: z
    .array(
      z.object({
        handle: z.string().max(64).optional(),
        text: z.string().min(1).max(2000),
      }),
    )
    .min(2)
    .max(50),
});


export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const db = getDb();
  const account = await getAccount(db, input.accountId);
  if (!account) {
    return Response.json({ error: "unknown accountId" }, { status: 400 });
  }

  const samples = await db
    .select()
    .from(voiceSamples)
    .where(eq(voiceSamples.accountId, account.id));

  const { system, user } = buildDiscoveryPrompt({
    voiceSamples: samples,
    persona: account.persona,
    recentTweets: input.tweets,
  });

  let modelOut: { narratives: Narrative[]; skipped: string[] };
  try {
    const text = await generateText({ system, user, maxTurns: 1 });
    modelOut = extractJson<{ narratives: Narrative[]; skipped: string[] }>(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }

  return Response.json({
    narratives: modelOut.narratives ?? [],
    skipped: modelOut.skipped ?? [],
  });
}

const SaveSchema = z.object({
  accountId: z.number().int().positive(),
  suggestions: z
    .array(
      z.object({
        text: z.string().min(1).max(2000),
        angle: z.string().max(120).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export async function PUT(request: Request) {
  const parsed = SaveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const db = getDb();
  const account = await getAccount(db, parsed.data.accountId);
  if (!account) {
    return Response.json({ error: "unknown accountId" }, { status: 400 });
  }
  const saved = await db
    .insert(drafts)
    .values(
      parsed.data.suggestions.map((s) => ({
        accountId: account.id,
        type: "original" as const,
        text: s.text,
        angle: s.angle ?? null,
        status: "pending" as const,
      })),
    )
    .returning();
  return Response.json({ saved });
}
