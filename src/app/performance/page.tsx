"use client";

import { useEffect, useMemo, useState } from "react";
import type { Draft } from "@/lib/schema";

type Metrics = {
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
};

function score(m: Metrics): number {
  return m.likes + 2 * m.retweets + 3 * m.replies;
}
function rate(m: Metrics): number | null {
  if (!m.impressions) return null;
  return ((m.likes + m.retweets + m.replies) / m.impressions) * 100;
}

export default function PerformancePage() {
  const [posts, setPosts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/drafts?status=posted&limit=500");
    const d = await r.json();
    setPosts(d.drafts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const ranked = useMemo(
    () => [...posts].sort((a, b) => score(b) - score(a)),
    [posts],
  );

  const totals = useMemo(() => {
    const t = { impressions: 0, likes: 0, retweets: 0, replies: 0 };
    for (const p of posts) {
      t.impressions += p.impressions;
      t.likes += p.likes;
      t.retweets += p.retweets;
      t.replies += p.replies;
    }
    return t;
  }, [posts]);

  const bestAngle = useMemo(() => {
    const byAngle: Record<string, { score: number; n: number }> = {};
    for (const p of posts) {
      if (!p.angle) continue;
      (byAngle[p.angle] ??= { score: 0, n: 0 });
      byAngle[p.angle].score += score(p);
      byAngle[p.angle].n += 1;
    }
    const entries = Object.entries(byAngle)
      .map(([angle, v]) => ({ angle, avg: v.score / v.n, n: v.n }))
      .sort((a, b) => b.avg - a.avg);
    return entries.slice(0, 3);
  }, [posts]);

  const bestType = useMemo(() => {
    const byType: Record<string, { score: number; n: number }> = {};
    for (const p of posts) {
      (byType[p.type] ??= { score: 0, n: 0 });
      byType[p.type].score += score(p);
      byType[p.type].n += 1;
    }
    return Object.entries(byType)
      .map(([type, v]) => ({ type, avg: v.score / v.n, n: v.n }))
      .sort((a, b) => b.avg - a.avg);
  }, [posts]);

  async function saveMetrics(id: number, m: Metrics) {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, ...m } : p)));
    await fetch(`/api/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(m),
    });
    load();
  }

  async function promoteToVoice(p: Draft) {
    await fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        samples: [
          { text: p.text, context: `high-performer (${score(p)} pts)` },
        ],
      }),
    });
  }

  return (
    <div className="p-10 max-w-4xl">
      <h1 className="text-3xl font-semibold mb-1">Performance</h1>
      <p className="text-muted mb-6">
        Log engagement on your posted tweets. Top performers automatically feed
        back into the generator&apos;s voice pool — and you can promote any one
        into your permanent voice samples.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Posted" value={posts.length} />
        <Stat label="Impressions" value={totals.impressions} />
        <Stat label="Likes" value={totals.likes} />
        <Stat
          label="RTs / Replies"
          value={`${totals.retweets} / ${totals.replies}`}
        />
      </div>

      {(bestAngle.length > 0 || bestType.length > 1) && (
        <div className="grid md:grid-cols-2 gap-3 mb-8">
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted mb-2">
              Best angles (avg score)
            </div>
            {bestAngle.length === 0 ? (
              <div className="text-sm text-muted">
                Log metrics to see what works.
              </div>
            ) : (
              <ul className="space-y-1 text-sm">
                {bestAngle.map((a) => (
                  <li key={a.angle} className="flex justify-between">
                    <span>{a.angle}</span>
                    <span className="text-muted">
                      {a.avg.toFixed(0)} · n={a.n}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted mb-2">
              Best formats (avg score)
            </div>
            <ul className="space-y-1 text-sm">
              {bestType.map((t) => (
                <li key={t.type} className="flex justify-between">
                  <span className="uppercase">{t.type}</span>
                  <span className="text-muted">
                    {t.avg.toFixed(0)} · n={t.n}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <h2 className="text-sm font-mono uppercase tracking-wider text-muted mb-3">
        Leaderboard ({posts.length})
      </h2>
      {loading ? (
        <div className="text-muted text-sm">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="text-muted text-sm border border-dashed border-border rounded-lg p-8 text-center">
          No posted tweets yet. Mark drafts &quot;posted&quot; in the queue,
          then log their numbers here.
        </div>
      ) : (
        <div className="space-y-3">
          {ranked.map((p, i) => (
            <PerfCard
              key={p.id}
              rank={i + 1}
              draft={p}
              onSave={(m) => saveMetrics(p.id, m)}
              onPromote={() => promoteToVoice(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="text-2xl font-semibold mt-1">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function PerfCard({
  rank,
  draft,
  onSave,
  onPromote,
}: {
  rank: number;
  draft: Draft;
  onSave: (m: Metrics) => void;
  onPromote: () => void;
}) {
  const [m, setM] = useState<Metrics>({
    impressions: draft.impressions,
    likes: draft.likes,
    retweets: draft.retweets,
    replies: draft.replies,
  });
  const [promoted, setPromoted] = useState(false);
  const dirty =
    m.impressions !== draft.impressions ||
    m.likes !== draft.likes ||
    m.retweets !== draft.retweets ||
    m.replies !== draft.replies;
  const s = score(m);
  const r = rate(m);

  const field = (key: keyof Metrics, label: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </span>
      <input
        type="number"
        min={0}
        value={m[key]}
        onChange={(e) =>
          setM((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value)) }))
        }
        className="w-20 bg-background border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent"
      />
    </label>
  );

  return (
    <div className="bg-surface border border-border rounded-md p-4">
      <div className="flex gap-3">
        <div className="text-lg font-mono text-muted w-6 shrink-0">{rank}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface-2 text-muted uppercase">
              {draft.type}
            </span>
            {draft.angle && (
              <span className="text-xs text-muted italic">{draft.angle}</span>
            )}
            <span className="text-xs ml-auto font-mono">
              score <span className="text-foreground font-semibold">{s}</span>
              {r !== null && (
                <span className="text-muted"> · {r.toFixed(1)}% eng</span>
              )}
            </span>
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap mb-3">
            {draft.text}
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            {field("impressions", "Impressions")}
            {field("likes", "Likes")}
            {field("retweets", "Retweets")}
            {field("replies", "Replies")}
            <button
              onClick={() => onSave(m)}
              disabled={!dirty}
              className="px-3 py-1.5 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={() => {
                onPromote();
                setPromoted(true);
                setTimeout(() => setPromoted(false), 1500);
              }}
              className="px-3 py-1.5 border border-border rounded-md text-sm hover:border-accent ml-auto"
            >
              {promoted ? "Added ✓" : "★ Promote to voice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
