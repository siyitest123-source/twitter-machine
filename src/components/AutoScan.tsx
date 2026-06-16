"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/lib/account-context";
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

function countHandles(raw: string): number {
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((t) => t.trim().replace(/^@/, "").toLowerCase())
      .filter((t) => /^[a-z0-9_]{1,15}$/.test(t)),
  ).size;
}

export function AutoScan({ accountId }: { accountId: number }) {
  const { current, refresh } = useAccount();
  const [handles, setHandles] = useState("");
  const [items, setItems] = useState<DiscoveredTweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Prefill the handle box from this account's saved scan list.
  useEffect(() => {
    setHandles(current?.scanHandles ?? "");
  }, [current?.id, current?.scanHandles]);

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

  const handleCount = countHandles(handles);

  async function scanNow() {
    setScanning(true);
    setErr(null);
    setSummary(null);
    try {
      const r = await fetch("/api/discover/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, handles }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error ?? "scan failed");
      else {
        setSummary(d);
        await Promise.all([load(), refresh()]); // refresh so saved handles persist in context
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
      <div className="mb-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted">
          Scan accounts
        </h2>
        <p className="text-xs text-muted mt-1">
          Enter the handles to watch. Pulls each one&apos;s recent tweets
          and drafts engagement in this account&apos;s voice. Saved per account
          and re-scanned daily at 8:00 CEST.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <textarea
          value={handles}
          onChange={(e) => setHandles(e.target.value)}
          rows={3}
          placeholder={`@cobie  @hosseeb  @VitalikButerin\n…or one per line, commas, or pasted profile URLs`}
          className="w-full bg-background border border-border rounded-md p-3 text-sm font-mono resize-y focus:outline-none focus:border-accent"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted">
            {handleCount} handle{handleCount === 1 ? "" : "s"} · public accounts
            only
          </span>
          <button
            onClick={scanNow}
            disabled={scanning || handleCount === 0}
            className="px-4 py-2 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {scanning ? "Scanning…" : "Scan now"}
          </button>
        </div>
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
          Nothing to review yet. Add some handles above and hit{" "}
          <strong>Scan now</strong>.
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
