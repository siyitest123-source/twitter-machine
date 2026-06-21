import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAccount } from "@/lib/accounts";
import { generateText } from "@/lib/claude";
import { getDb } from "@/lib/db";
import { buildWeeklyPlanPrompt, type PlannedPost } from "@/lib/prompts";
import { drafts, voiceSamples } from "@/lib/schema";

const BodySchema = z.object({
  accountId: z.number().int().positive(),
  brief: z.string().min(1).max(4000),
  requirements: z.string().max(4000).optional(),
  postsPerDay: z.number().int().min(1).max(8).optional(),
  daysInWeek: z.number().int().min(1).max(14).optional(),
  startDateISO: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD")
    .optional(),
  saveAsDrafts: z.boolean().optional(),
});

function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("model did not return JSON");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Human-readable "suggested: Mon 14:00 UTC" hint, stored in the draft's angle. */
function suggestionHint(
  startISO: string,
  dayOffset: number,
  hourUtc: number,
): string {
  const [y, m, d] = startISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dayOffset);
  return `suggested ${DAY_NAMES[dt.getUTCDay()]} ${String(hourUtc).padStart(2, "0")}:00 UTC`;
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
  const startISO = input.startDateISO ?? todayISO();
  const daysInWeek = input.daysInWeek ?? 7;
  const postsPerDay = input.postsPerDay ?? 3;

  const db = getDb();
  const account = await getAccount(db, input.accountId);
  if (!account) {
    return Response.json({ error: "unknown accountId" }, { status: 400 });
  }

  const samples = await db
    .select()
    .from(voiceSamples)
    .where(eq(voiceSamples.accountId, account.id));

  const { system, user } = buildWeeklyPlanPrompt({
    voiceSamples: samples,
    persona: account.persona,
    brief: input.brief,
    requirements: input.requirements,
    postsPerDay,
    daysInWeek,
    startDateISO: startISO,
  });

  let modelOut: { posts: PlannedPost[] };
  try {
    const text = await generateText({
      system,
      user,
      maxTurns: 1,
    });
    modelOut = extractJson(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }

  const posts = (modelOut.posts ?? []).filter(
    (p) => p && typeof p.text === "string" && p.text.length > 0,
  );

  let saved: typeof drafts.$inferSelect[] = [];
  if (input.saveAsDrafts !== false && posts.length > 0) {
    saved = await db
      .insert(drafts)
      .values(
        posts.map((p) => {
          const hint = suggestionHint(
            startISO,
            Math.max(0, Math.min(daysInWeek - 1, p.day_offset)),
            Math.max(0, Math.min(23, p.suggested_hour_utc ?? 14)),
          );
          return {
            accountId: account.id,
            type:
              p.type === "thread" ? ("thread" as const) : ("original" as const),
            text: p.text,
            threadParts:
              p.type === "thread" && p.thread_continuation?.length
                ? JSON.stringify(p.thread_continuation)
                : null,
            // Fold the model's timing suggestion into the angle as a hint;
            // do NOT pre-schedule. Posts land as unscheduled pending drafts so
            // you review them in the Queue and schedule (drag onto Calendar)
            // when you're ready.
            angle: p.angle ? `${p.angle} · ${hint}` : hint,
            status: "pending" as const,
            scheduledFor: null,
          };
        }),
      )
      .returning();
  }

  return Response.json({
    posts,
    saved,
    startDateISO: startISO,
    daysInWeek,
  });
}
