import { z } from "zod";
import { generateText } from "@/lib/claude";
import { getDb } from "@/lib/db";
import { getTopPerformers } from "@/lib/performance";
import { buildWeeklyPlanPrompt, type PlannedPost } from "@/lib/prompts";
import { drafts, voiceSamples } from "@/lib/schema";

const BodySchema = z.object({
  themes: z.array(z.string().min(1).max(200)).min(1).max(15),
  avoid: z.array(z.string().min(1).max(200)).max(15).optional(),
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

function scheduledForUnix(startISO: string, dayOffset: number, hourUtc: number) {
  const [y, m, d] = startISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hourUtc, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + dayOffset);
  return Math.floor(dt.getTime() / 1000);
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
  const [samples, topPerformers] = await Promise.all([
    db.select().from(voiceSamples),
    getTopPerformers(db, 5),
  ]);

  const { system, user } = buildWeeklyPlanPrompt({
    voiceSamples: [...topPerformers, ...samples],
    themes: input.themes,
    avoid: input.avoid,
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
        posts.map((p) => ({
          type: p.type === "thread" ? ("thread" as const) : ("original" as const),
          text: p.text,
          threadParts:
            p.type === "thread" && p.thread_continuation?.length
              ? JSON.stringify(p.thread_continuation)
              : null,
          angle: p.angle ?? null,
          status: "pending" as const,
          scheduledFor: scheduledForUnix(
            startISO,
            Math.max(0, Math.min(daysInWeek - 1, p.day_offset)),
            Math.max(0, Math.min(23, p.suggested_hour_utc ?? 14)),
          ),
        })),
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
