"use client";

import { useState } from "react";
import { AutoScan } from "@/components/AutoScan";
import { NoAccount } from "@/components/NoAccount";
import { useAccount } from "@/lib/account-context";

type Suggestion = {
  text: string;
  angle: string;
  stance: "amplify" | "contrarian" | "observation";
};

type Narrative = {
  label: string;
  summary: string;
  tweet_indices: number[];
  heat: "rising" | "peak" | "cooling";
  suggestions: Suggestion[];
};

const HEAT_STYLES: Record<Narrative["heat"], string> = {
  rising: "bg-success/20 text-success",
  peak: "bg-accent/25 text-accent",
  cooling: "bg-surface-2 text-muted",
};

const STANCE_LABELS: Record<Suggestion["stance"], string> = {
  amplify: "amplify",
  contrarian: "contrarian",
  observation: "observation",
};

function parseTweets(raw: string): { handle?: string; text: string }[] {
  return raw
    .split(/\n\n+|\n---+\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const m = block.match(/^@?([A-Za-z0-9_]{1,15})\s*[:\-—]\s*([\s\S]+)$/);
      if (m) return { handle: m[1], text: m[2].trim() };
      return { text: block };
    });
}

export default function DiscoverPage() {
  const { currentId } = useAccount();
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [narratives, setNarratives] = useState<Narrative[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const parsed = parseTweets(raw);

  async function analyze() {
    setLoading(true);
    setErr(null);
    setNarratives(null);
    setSkipped([]);
    setSelected(new Set());
    setSavedCount(null);
    try {
      const r = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: currentId, tweets: parsed }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error ?? "failed");
      } else {
        setNarratives(d.narratives ?? []);
        setSkipped(d.skipped ?? []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function saveSelected() {
    if (!narratives) return;
    const items: { text: string; angle: string }[] = [];
    for (const key of selected) {
      const [ni, si] = key.split(":").map(Number);
      const s = narratives[ni]?.suggestions[si];
      if (s) items.push({ text: s.text, angle: s.angle });
    }
    if (items.length === 0) return;
    const r = await fetch("/api/discover", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: currentId, suggestions: items }),
    });
    if (r.ok) {
      const d = await r.json();
      setSavedCount(d.saved?.length ?? 0);
      setSelected(new Set());
    }
  }

  if (currentId === null) return <NoAccount />;

  return (
    <div className="p-10 max-w-4xl">
      <h1 className="text-3xl font-semibold mb-1">Discover</h1>
      <p className="text-muted mb-6">
        Auto-scan your target accounts for tweets worth engaging with, or paste
        a feed manually to cluster it into narratives.
      </p>

      {/* Auto-scan: fetches target accounts, drafts engagement per tweet */}
      <AutoScan accountId={currentId} />

      {/* Manual narrative clustering — kept for when you want to paste a feed */}
      <details className="bg-surface border border-border rounded-lg mb-6">
        <summary className="cursor-pointer px-5 py-4 text-sm font-mono uppercase tracking-wider text-muted hover:text-foreground">
          Manual: paste a feed → narrative clusters
        </summary>
        <div className="px-5 pb-5">
          <p className="text-xs text-muted mb-3">
            Paste recent tweets (one per block, blank line between, optionally{" "}
            <code>@handle: text</code>). Clusters them into narratives and
            suggests proactive posts.
          </p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            placeholder={`@cobie: another L2 launches with a $50M valuation and the only differentiator is the color of their logo\n\n@hosseeb: restaking yields are about to compress hard. nobody is pricing this in`}
            className="w-full bg-background border border-border rounded-md p-3 text-sm font-mono resize-y focus:outline-none focus:border-accent"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted">
              {parsed.length} tweets detected
            </span>
            <button
              onClick={analyze}
              disabled={parsed.length < 2 || loading}
              className="px-4 py-2 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Analyzing…" : "Find narratives"}
            </button>
          </div>
        </div>
      </details>

      {err && (
        <div className="mb-4 p-4 bg-surface border border-danger rounded-md text-sm text-danger">
          {err}
        </div>
      )}
      {savedCount !== null && (
        <div className="mb-4 p-3 bg-surface border border-success/40 rounded-md text-sm">
          <span className="text-success font-medium">{savedCount}</span>{" "}
          suggestions saved to the queue.
        </div>
      )}

      {narratives && narratives.length === 0 && (
        <div className="text-muted text-sm border border-dashed border-border rounded-lg p-8 text-center">
          No clear narratives in this batch. Try with more tweets.
        </div>
      )}

      {narratives && narratives.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-mono uppercase tracking-wider text-muted">
              Narratives ({narratives.length})
            </h2>
            <button
              onClick={saveSelected}
              disabled={selected.size === 0}
              className="px-3 py-1.5 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save {selected.size} to queue
            </button>
          </div>
          <div className="space-y-4">
            {narratives.map((n, ni) => (
              <div
                key={ni}
                className="bg-surface border border-border rounded-lg p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{n.label}</span>
                  <span
                    className={`text-xs font-mono px-1.5 py-0.5 rounded ${HEAT_STYLES[n.heat]}`}
                  >
                    {n.heat}
                  </span>
                  <span className="text-xs text-muted ml-auto">
                    {n.tweet_indices.length} tweets
                  </span>
                </div>
                <div className="text-sm text-muted mb-4">{n.summary}</div>
                <div className="space-y-2">
                  {n.suggestions.map((s, si) => {
                    const key = `${ni}:${si}`;
                    const isSel = selected.has(key);
                    return (
                      <label
                        key={si}
                        className={`block cursor-pointer border rounded-md p-3 transition-colors ${
                          isSel
                            ? "border-accent bg-accent/5"
                            : "border-border hover:border-foreground"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => toggle(key)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface-2 text-muted">
                                {STANCE_LABELS[s.stance]}
                              </span>
                              <span className="text-xs text-muted italic">
                                {s.angle}
                              </span>
                              <span
                                className={`text-xs ml-auto ${s.text.length > 280 ? "text-danger" : "text-muted"}`}
                              >
                                {s.text.length}/280
                              </span>
                            </div>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                              {s.text}
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {skipped.length > 0 && (
            <details className="mt-6 text-sm text-muted">
              <summary className="cursor-pointer hover:text-foreground">
                Skipped {skipped.length} narrative(s)
              </summary>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                {skipped.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
