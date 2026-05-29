import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAccount } from "@/lib/accounts";
import { generateText } from "@/lib/claude";
import { getDb } from "@/lib/db";
import { getTopPerformers } from "@/lib/performance";
import { buildGenerationPrompt, type DraftType } from "@/lib/prompts";
import { drafts, voiceSamples } from "@/lib/schema";

const BodySchema = z.object({
  accountId: z.number().int().positive(),
  type: z.enum(["reply", "qrt", "original"]),
  sourceUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  sourceText: z.string().max(4000).optional(),
  sourceHandle: z.string().max(64).optional(),
  topic: z.string().max(500).optional(),
  angles: z.array(z.string().max(120)).max(5).optional(),
  numCandidates: z.number().int().min(1).max(5).optional(),
  saveAsDrafts: z.boolean().optional(),
});

type Candidate = { text: string; angle: string };
type ModelResponse = {
  candidates: Candidate[];
  skipped_reason: string | null;
};

function extractJson(text: string): ModelResponse {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("model did not return JSON");
  }
  const slice = text.slice(start, end + 1);
  return JSON.parse(slice) as ModelResponse;
}

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  if (input.type !== "original" && !input.sourceText) {
    return Response.json(
      { error: "sourceText required for reply/qrt" },
      { status: 400 },
    );
  }

  const db = getDb();
  const account = await getAccount(db, input.accountId);
  if (!account) {
    return Response.json({ error: "unknown accountId" }, { status: 400 });
  }

  const [samples, topPerformers] = await Promise.all([
    db
      .select()
      .from(voiceSamples)
      .where(eq(voiceSamples.accountId, account.id)),
    getTopPerformers(db, account.id, 5),
  ]);
  // Posts that actually performed get folded into the voice pool so the
  // generator leans toward what worked — scoped to this account only.
  const voicePool = [...topPerformers, ...samples];

  const { system, user } = buildGenerationPrompt({
    type: input.type as DraftType,
    voiceSamples: voicePool,
    persona: account.persona,
    sourceText: input.sourceText,
    sourceHandle: input.sourceHandle,
    topic: input.topic,
    angles: input.angles,
    numCandidates: input.numCandidates ?? 3,
  });

  let modelOut: ModelResponse;
  try {
    const text = await generateText({ system, user });
    modelOut = extractJson(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }

  if (modelOut.skipped_reason) {
    return Response.json({
      candidates: [],
      skippedReason: modelOut.skipped_reason,
      saved: [],
    });
  }

  let saved: typeof drafts.$inferSelect[] = [];
  if (input.saveAsDrafts !== false) {
    saved = await db
      .insert(drafts)
      .values(
        modelOut.candidates.map((c) => ({
          accountId: account.id,
          type: input.type,
          text: c.text,
          angle: c.angle,
          sourceUrl: input.sourceUrl ?? null,
          sourceText: input.sourceText ?? null,
          sourceHandle: input.sourceHandle?.replace(/^@/, "") ?? null,
          status: "pending" as const,
        })),
      )
      .returning();
  }

  return Response.json({
    candidates: modelOut.candidates,
    saved,
    skippedReason: null,
  });
}
