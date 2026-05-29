"use client";

import { useCallback, useEffect, useState } from "react";
import { NoAccount } from "@/components/NoAccount";
import { useAccount } from "@/lib/account-context";
import type { Draft } from "@/lib/schema";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function unix(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function hhmm(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_BORDER: Record<string, string> = {
  pending: "border-border",
  approved: "border-success/60",
  posted: "border-accent/60",
  rejected: "border-danger/40",
};

export default function CalendarPage() {
  const { currentId } = useAccount();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [scheduled, setScheduled] = useState<Draft[]>([]);
  const [backlog, setBacklog] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<number | null>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const weekEnd = addDays(weekStart, 7);

  const load = useCallback(async () => {
    if (currentId === null) return;
    setLoading(true);
    const [sch, bk] = await Promise.all([
      fetch(
        `/api/drafts?status=all&accountId=${currentId}&from=${unix(weekStart)}&to=${unix(weekEnd)}&limit=500`,
      ).then((r) => r.json()),
      fetch(
        `/api/drafts?status=pending&accountId=${currentId}&unscheduled=1&limit=200`,
      ).then((r) => r.json()),
    ]);
    setScheduled(sch.drafts ?? []);
    setBacklog(bk.drafts ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, currentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function moveToDay(id: number, dayIndex: number) {
    const target = addDays(weekStart, dayIndex);
    const all = [...scheduled, ...backlog];
    const draft = all.find((d) => d.id === id);
    if (!draft) return;
    if (draft.scheduledFor) {
      const old = new Date(draft.scheduledFor * 1000);
      target.setHours(old.getHours(), old.getMinutes(), 0, 0);
    } else {
      target.setHours(14, 0, 0, 0);
    }
    const newTs = unix(target);
    // optimistic
    setBacklog((b) => b.filter((d) => d.id !== id));
    setScheduled((s) => {
      const without = s.filter((d) => d.id !== id);
      return [...without, { ...draft, scheduledFor: newTs }];
    });
    await fetch(`/api/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledFor: newTs }),
    });
    load();
  }

  async function unschedule(id: number) {
    const draft = scheduled.find((d) => d.id === id);
    setScheduled((s) => s.filter((d) => d.id !== id));
    if (draft && draft.status === "pending") {
      setBacklog((b) => [{ ...draft, scheduledFor: null }, ...b]);
    }
    await fetch(`/api/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledFor: null }),
    });
    load();
  }

  if (currentId === null) return <NoAccount />;

  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const draftsForDay = (day: Date) =>
    scheduled
      .filter((d) => d.scheduledFor && sameDay(new Date(d.scheduledFor * 1000), day))
      .sort((a, b) => (a.scheduledFor ?? 0) - (b.scheduledFor ?? 0));

  return (
    <div className="p-10 max-w-7xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-3xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:border-foreground"
          >
            ← Prev
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:border-foreground"
          >
            This week
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:border-foreground"
          >
            Next →
          </button>
        </div>
      </div>
      <p className="text-muted mb-6">
        {weekStart.toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
        })}{" "}
        –{" "}
        {addDays(weekStart, 6).toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        . Drag posts between days to reschedule. {loading && "Loading…"}
      </p>

      {/* Backlog */}
      <div
        className="mb-6 bg-surface border border-border rounded-lg p-4"
        onDragOver={(e) => {
          if (dragId !== null) e.preventDefault();
        }}
        onDrop={() => {
          if (dragId !== null) unschedule(dragId);
          setDragId(null);
        }}
      >
        <div className="text-xs font-mono uppercase tracking-wider text-muted mb-2">
          Backlog — unscheduled pending ({backlog.length}) · drag onto a day to
          schedule
        </div>
        <div className="flex gap-2 flex-wrap min-h-[2rem]">
          {backlog.length === 0 ? (
            <span className="text-xs text-muted">
              Nothing unscheduled. Generated drafts and discovery picks land
              here.
            </span>
          ) : (
            backlog.map((d) => (
              <CalCard
                key={d.id}
                draft={d}
                onDragStart={() => setDragId(d.id)}
                onDragEnd={() => setDragId(null)}
                compact
              />
            ))
          )}
        </div>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const isToday = sameDay(day, now);
          const items = draftsForDay(day);
          return (
            <div
              key={i}
              onDragOver={(e) => {
                if (dragId !== null) {
                  e.preventDefault();
                  setHoverDay(i);
                }
              }}
              onDragLeave={() => setHoverDay((h) => (h === i ? null : h))}
              onDrop={() => {
                if (dragId !== null) moveToDay(dragId, i);
                setDragId(null);
                setHoverDay(null);
              }}
              className={`min-h-[24rem] rounded-lg border p-2 transition-colors ${
                hoverDay === i
                  ? "border-accent bg-accent/5"
                  : isToday
                    ? "border-accent/40 bg-surface"
                    : "border-border bg-surface"
              }`}
            >
              <div className="flex items-baseline justify-between px-1 mb-2">
                <span
                  className={`text-xs font-mono uppercase tracking-wider ${isToday ? "text-accent" : "text-muted"}`}
                >
                  {DAY_NAMES[i]}
                </span>
                <span className="text-xs text-muted">{day.getDate()}</span>
              </div>
              <div className="space-y-2">
                {items.map((d) => (
                  <CalCard
                    key={d.id}
                    draft={d}
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => setDragId(null)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalCard({
  draft,
  onDragStart,
  onDragEnd,
  compact,
}: {
  draft: Draft;
  onDragStart: () => void;
  onDragEnd: () => void;
  compact?: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={draft.text}
      className={`cursor-grab active:cursor-grabbing rounded-md border bg-background p-2 ${STATUS_BORDER[draft.status] ?? "border-border"} ${compact ? "max-w-[15rem]" : ""}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {draft.scheduledFor && !compact && (
          <span className="text-[10px] font-mono text-muted">
            {hhmm(draft.scheduledFor)}
          </span>
        )}
        <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-surface-2 text-muted uppercase">
          {draft.type}
        </span>
        {draft.status === "approved" && (
          <span className="text-[10px] text-success">✓</span>
        )}
        {draft.status === "posted" && (
          <span className="text-[10px] text-accent">posted</span>
        )}
      </div>
      <div className="text-xs leading-snug line-clamp-4">{draft.text}</div>
    </div>
  );
}
