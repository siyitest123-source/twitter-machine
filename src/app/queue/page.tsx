"use client";

import { useCallback, useEffect, useState } from "react";
import { NoAccount } from "@/components/NoAccount";
import { useAccount } from "@/lib/account-context";
import type { Draft } from "@/lib/schema";

type Status = "pending" | "approved" | "rejected" | "posted" | "all";

const STATUS_TABS: Status[] = ["pending", "approved", "posted", "rejected"];

export default function QueuePage() {
  const { currentId } = useAccount();
  const [status, setStatus] = useState<Status>("pending");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [counts, setCounts] = useState<{ status: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (s: Status = status) => {
      if (currentId === null) return;
      setLoading(true);
      const r = await fetch(
        `/api/drafts?status=${s}&accountId=${currentId}&limit=200`,
      );
      const d = await r.json();
      setDrafts(d.drafts ?? []);
      setCounts(d.counts ?? []);
      setLoading(false);
    },
    [status, currentId],
  );

  useEffect(() => {
    load(status);
  }, [load, status]);

  async function patch(id: number, body: Partial<Draft>) {
    const r = await fetch(`/api/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const d = await r.json();
      setDrafts((ds) =>
        body.status && body.status !== status
          ? ds.filter((x) => x.id !== id)
          : ds.map((x) => (x.id === id ? d.draft : x)),
      );
      load(status);
    }
  }

  async function remove(id: number) {
    await fetch(`/api/drafts/${id}`, { method: "DELETE" });
    setDrafts((ds) => ds.filter((x) => x.id !== id));
    load(status);
  }

  const countFor = (s: string) =>
    counts.find((c) => c.status === s)?.count ?? 0;

  if (currentId === null) return <NoAccount />;

  return (
    <div className="p-10 max-w-3xl">
      <h1 className="text-3xl font-semibold mb-1">Approval Queue</h1>
      <p className="text-muted mb-6">
        Edit, approve, or reject. Approved drafts get a one-click copy + open-X
        button.
      </p>

      <div className="flex gap-2 mb-6 border-b border-border">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${
              status === s
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {s} <span className="text-muted">({countFor(s)})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted text-sm">Loading…</div>
      ) : drafts.length === 0 ? (
        <div className="text-muted text-sm border border-dashed border-border rounded-lg p-8 text-center">
          No {status} drafts.
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              onPatch={(body) => patch(d.id, body)}
              onDelete={() => remove(d.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatScheduled(unix: number): string {
  const d = new Date(unix * 1000);
  const date = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

function DraftCard({
  draft,
  onPatch,
  onDelete,
}: {
  draft: Draft;
  onPatch: (body: Partial<Draft>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft.text);
  const [copied, setCopied] = useState(false);
  const len = text.length;
  const threadParts: string[] = draft.threadParts
    ? (() => {
        try {
          return JSON.parse(draft.threadParts) as string[];
        } catch {
          return [];
        }
      })()
    : [];

  return (
    <div className="bg-surface border border-border rounded-md p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface-2 text-muted uppercase">
          {draft.type}
        </span>
        {threadParts.length > 0 && (
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent">
            thread · {threadParts.length + 1}
          </span>
        )}
        {draft.angle && (
          <span className="text-xs text-muted">{draft.angle}</span>
        )}
        {draft.sourceHandle && (
          <span className="text-xs text-muted">
            ↳ @{draft.sourceHandle}
          </span>
        )}
        {draft.scheduledFor && (
          <span className="text-xs text-muted">
            📅 {formatScheduled(draft.scheduledFor)}
          </span>
        )}
        <span
          className={`text-xs ml-auto ${len > 280 ? "text-danger" : "text-muted"}`}
        >
          {len}/280
        </span>
      </div>

      {draft.sourceText && (
        <details className="mb-3 text-xs text-muted">
          <summary className="cursor-pointer hover:text-foreground">
            Source tweet
          </summary>
          <div className="mt-2 pl-3 border-l-2 border-border whitespace-pre-wrap">
            {draft.sourceText}
          </div>
        </details>
      )}

      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full bg-background border border-border rounded-md p-3 text-sm resize-y focus:outline-none focus:border-accent"
        />
      ) : (
        <div className="whitespace-pre-wrap text-sm leading-relaxed mb-3">
          {text}
        </div>
      )}

      {threadParts.length > 0 && (
        <details className="mb-3">
          <summary className="text-xs text-muted cursor-pointer hover:text-foreground">
            Thread continuation ({threadParts.length} more)
          </summary>
          <ol className="mt-2 space-y-2 text-sm leading-relaxed">
            {threadParts.map((t, i) => (
              <li
                key={i}
                className="pl-3 border-l-2 border-border whitespace-pre-wrap"
              >
                <span className="text-xs text-muted mr-2">
                  {String(i + 2).padStart(2, "0")}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </details>
      )}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {editing ? (
          <>
            <button
              onClick={() => {
                onPatch({ text });
                setEditing(false);
              }}
              className="text-xs px-2.5 py-1 bg-accent text-accent-fg rounded"
            >
              Save edit
            </button>
            <button
              onClick={() => {
                setText(draft.text);
                setEditing(false);
              }}
              className="text-xs px-2.5 py-1 border border-border rounded hover:border-foreground"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-2.5 py-1 border border-border rounded hover:border-foreground"
          >
            Edit
          </button>
        )}
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-xs px-2.5 py-1 border border-border rounded hover:border-foreground"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <a
          href={
            draft.type === "reply" && draft.sourceUrl
              ? draft.sourceUrl
              : `https://x.com/intent/post?text=${encodeURIComponent(text)}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-2.5 py-1 border border-border rounded hover:border-foreground"
        >
          Open in X →
        </a>

        <div className="ml-auto flex gap-2">
          {draft.status !== "approved" && (
            <button
              onClick={() => onPatch({ status: "approved" })}
              className="text-xs px-2.5 py-1 bg-success/15 text-success border border-success/40 rounded"
            >
              Approve
            </button>
          )}
          {draft.status !== "rejected" && (
            <button
              onClick={() => onPatch({ status: "rejected" })}
              className="text-xs px-2.5 py-1 border border-border rounded hover:text-danger hover:border-danger"
            >
              Reject
            </button>
          )}
          {draft.status === "approved" && (
            <button
              onClick={() => onPatch({ status: "posted" })}
              className="text-xs px-2.5 py-1 border border-border rounded hover:border-foreground"
            >
              Mark posted
            </button>
          )}
          <button
            onClick={onDelete}
            className="text-xs px-2.5 py-1 text-muted hover:text-danger"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
