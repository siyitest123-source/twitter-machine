"use client";

import { useState } from "react";

type PlannedPost = {
  day_offset: number;
  type: "original" | "thread";
  text: string;
  thread_continuation: string[] | null;
  angle: string;
  suggested_hour_utc: number;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function todayISO(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function dayLabel(startISO: string, offset: number): string {
  const [y, m, d] = startISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + offset);
  return `${DAY_LABELS[dt.getUTCDay() === 0 ? 6 : dt.getUTCDay() - 1]} ${String(dt.getUTCMonth() + 1).padStart(2, "0")}/${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export default function PlanPage() {
  const [themes, setThemes] = useState("");
  const [avoid, setAvoid] = useState("");
  const [postsPerDay, setPostsPerDay] = useState(3);
  const [days, setDays] = useState(7);
  const [startDate, setStartDate] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [posts, setPosts] = useState<PlannedPost[]>([]);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  async function generate() {
    setLoading(true);
    setErr(null);
    setPosts([]);
    setSavedCount(null);
    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themes: themes
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          avoid: avoid
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          postsPerDay,
          daysInWeek: days,
          startDateISO: startDate,
          saveAsDrafts: true,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error ?? "failed");
      } else {
        setPosts(d.posts ?? []);
        setSavedCount(d.saved?.length ?? 0);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }

  const ready = themes.trim().length > 0 && !loading;

  const byDay: Record<number, PlannedPost[]> = {};
  for (const p of posts) {
    const k = Math.max(0, Math.min(days - 1, p.day_offset));
    (byDay[k] ??= []).push(p);
  }
  for (const k of Object.keys(byDay)) {
    byDay[Number(k)].sort(
      (a, b) => a.suggested_hour_utc - b.suggested_hour_utc,
    );
  }

  return (
    <div className="p-10 max-w-6xl">
      <h1 className="text-3xl font-semibold mb-1">Weekly Plan</h1>
      <p className="text-muted mb-6">
        Give it your themes for the week. It generates a calendar of original
        posts in your voice, scheduled by day and suggested hour. Saved to the
        queue.
      </p>

      <div className="bg-surface border border-border rounded-lg p-5 space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">
              Themes (one per line)
            </label>
            <textarea
              value={themes}
              onChange={(e) => setThemes(e.target.value)}
              rows={5}
              placeholder={`restaking yield compression\nL2 economic models\nyour launch on Thursday`}
              className="w-full bg-background border border-border rounded-md p-3 text-sm resize-y focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">
              Avoid (one per line, optional)
            </label>
            <textarea
              value={avoid}
              onChange={(e) => setAvoid(e.target.value)}
              rows={5}
              placeholder={`meme coins\ngm posts\nanything about competitor X`}
              className="w-full bg-background border border-border rounded-md p-3 text-sm resize-y focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">
              Days
            </label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              {[3, 5, 7, 14].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">
              Posts / day
            </label>
            <select
              value={postsPerDay}
              onChange={(e) => setPostsPerDay(Number(e.target.value))}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto">
            <button
              onClick={generate}
              disabled={!ready}
              className="px-4 py-2 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Planning…" : `Plan ${days * postsPerDay} posts`}
            </button>
          </div>
        </div>
      </div>

      {err && (
        <div className="mb-4 p-4 bg-surface border border-danger rounded-md text-sm text-danger">
          {err}
        </div>
      )}
      {savedCount !== null && (
        <div className="mb-4 p-3 bg-surface border border-success/40 rounded-md text-sm">
          <span className="text-success font-medium">{savedCount}</span> posts
          saved to the queue with scheduled dates. Review them in{" "}
          <a className="underline" href="/queue">
            Approval Queue
          </a>
          .
        </div>
      )}

      {posts.length > 0 && (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${Math.min(days, 7)}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: days }).map((_, day) => (
            <div key={day} className="space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-muted px-1">
                {dayLabel(startDate, day)}
              </div>
              {(byDay[day] ?? []).map((p, i) => (
                <PostCard key={i} post={p} />
              ))}
              {!byDay[day] && (
                <div className="border border-dashed border-border rounded-md p-3 text-xs text-muted text-center">
                  —
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({ post }: { post: PlannedPost }) {
  const isThread = post.type === "thread" && post.thread_continuation?.length;
  return (
    <div className="bg-surface border border-border rounded-md p-3">
      <div className="flex items-center gap-1.5 mb-2 text-xs">
        <span className="font-mono px-1.5 py-0.5 rounded bg-surface-2 text-muted">
          {String(post.suggested_hour_utc).padStart(2, "0")}:00 UTC
        </span>
        {isThread && (
          <span className="font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent">
            thread · {(post.thread_continuation?.length ?? 0) + 1}
          </span>
        )}
      </div>
      <div className="text-xs text-muted mb-1.5 italic">{post.angle}</div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {post.text}
      </div>
      {isThread && (
        <details className="mt-2">
          <summary className="text-xs text-muted cursor-pointer hover:text-foreground">
            see {post.thread_continuation?.length} more
          </summary>
          <ol className="mt-2 space-y-1.5 text-sm leading-relaxed">
            {post.thread_continuation?.map((t, i) => (
              <li
                key={i}
                className="pl-3 border-l-2 border-border whitespace-pre-wrap"
              >
                {t}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
