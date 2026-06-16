"use client";

import { useCallback, useEffect, useState } from "react";
import type { DiscoveredTweet } from "@/lib/schema";

type ScanSummary = {
  handlesScanned: number;
  tweetsFetched: number;
  newCandidates: number;
  stored: number;
  fetchErrors: { handle: string; error: string }[];
};

function ago(unix: number | null): string {
  if (!unix) return "";
  const s = Math.floor(Date.now() / 1000) - unix;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function AutoScan({ accountId }: { accountId: number }) {
  const [items, setItems] = useState<DiscoveredTweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/discover/scan?accountId=${accountId}&status=new`);
    const d = await r.json();
    setItems(d.discovered ?? []);
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  async function scanNow() {
    setScanning(true);
    setErr(null);
    setSummary(null);
    try {
      const r = await fetch("/api/discover/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error ?? "scan failed");
      else {
        setSummary(d);
        await load();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setScanning(false);
  }

  function removeItem(id: number) {
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted">
            Auto-scan · target accounts
          </h2>
          <p className="text-xs text-muted mt-1">
            Pulls the last 24h from your engage/amplify targets and drafts
            engagement in this account&apos;s voice. Runs daily at 8:00 CEST;
            scan anytime below.
          </p>
        </div>
        <button
          onClick={scanNow}
          disabled={scanning}
          className="px-4 py-2 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {scanning ? "Scanning…" : "Scan now"}
        </button>
      </div>

      {err && (
        <div className="mb-3 p-3 bg-surface border border-danger rounded-md text-sm text-danger">
          {err}
        </div>
      )}
      {summary && (
        <div className="mb-3 p-3 bg-surface border border-border rounded-md text-xs text-muted">
          Scanned {summary.handlesScanned} handles · {summary.tweetsFetched}{" "}
          tweets fetched · {summary.stored} new to review
          {summary.fetchErrors.length > 0 && (
            <span className="text-danger">
              {" "}
              · {summary.fetchErrors.length} handle
              {summary.fetchErrors.length === 1 ? "" : "s"} failed (
              {summary.fetchErrors.map((f) => `@${f.handle}`).join(", ")})
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-muted text-sm border border-dashed border-border rounded-lg p-8 text-center">
          Nothing to review. Hit <strong>Scan now</strong> — make sure the
          account has <em>engage</em> or <em>amplify</em> targets in{" "}
          <a href="/targets" className="text-accent underline">
            Targets
          </a>
          .
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <DiscoveredCard
              key={item.id}
              item={item}
              onGone={() => removeItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DiscoveredCard({
  item,
  onGone,
}: {
  item: DiscoveredTweet;
  onGone: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(kind: "reply" | "qrt") {
    setBusy(kind);
    const r = await fetch(`/api/discover/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", kind }),
    });
    setBusy(null);
    if (r.ok) {
      setSaved(kind);
      setTimeout(onGone, 900);
    }
  }

  async function dismiss() {
    setBusy("dismiss");
    const r = await fetch(`/api/discover/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    if (r.ok) onGone();
    else setBusy(null);
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      {/* Source tweet */}
      <div className="flex items-center gap-2 mb-2 text-xs">
        <a
          href={item.sourceUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:text-accent"
        >
          @{item.sourceHandle}
        </a>
        <span className="text-muted">{ago(item.tweetCreatedAt)}</span>
        <span className="text-muted">
          ♥ {item.likes} · ↻ {item.retweets}
        </span>
        <span className="ml-auto font-mono px-1.5 py-0.5 rounded bg-surface-2 text-muted">
          relevance {item.relevance}/10
        </span>
      </div>
      <div className="text-sm text-muted whitespace-pre-wrap border-l-2 border-border pl-3 mb-4">
        {item.sourceText}
      </div>

      {/* Suggested engagements */}
      <div className="space-y-2">
        {item.replyDraft && (
          <Engagement
            label="Reply"
            text={item.replyDraft}
            onSave={() => save("reply")}
            busy={busy === "reply"}
            saved={saved === "reply"}
          />
        )}
        {item.qrtDraft && (
          <Engagement
            label="Quote-RT"
            text={item.qrtDraft}
            onSave={() => save("qrt")}
            busy={busy === "qrt"}
            saved={saved === "qrt"}
          />
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <a
          href={item.sourceUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-2.5 py-1 border border-border rounded hover:border-foreground"
        >
          Open tweet ↗
        </a>
        <button
          onClick={dismiss}
          disabled={busy === "dismiss"}
          className="text-xs px-2.5 py-1 text-muted hover:text-danger ml-auto"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function Engagement({
  label,
  text,
  onSave,
  busy,
  saved,
}: {
  label: string;
  text: string;
  onSave: () => void;
  busy: boolean;
  saved: boolean;
}) {
  return (
    <div className="border border-border rounded-md p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface-2 text-muted">
          {label}
        </span>
        <span
          className={`text-xs ml-auto ${text.length > 280 ? "text-danger" : "text-muted"}`}
        >
          {text.length}/280
        </span>
        <button
          onClick={onSave}
          disabled={busy || saved}
          className="text-xs px-2.5 py-1 bg-accent text-accent-fg rounded disabled:opacity-50"
        >
          {saved ? "Saved ✓" : busy ? "Saving…" : "Save to queue"}
        </button>
      </div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">{text}</div>
    </div>
  );
}
