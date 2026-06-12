"use client";

import Link from "next/link";
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

  function onImage(updated: Draft) {
    setDrafts((ds) => ds.map((x) => (x.id === updated.id ? updated : x)));
  }

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
              onImage={onImage}
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
  onImage,
}: {
  draft: Draft;
  onPatch: (body: Partial<Draft>) => void;
  onDelete: () => void;
  onImage: (updated: Draft) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft.text);
  const [copied, setCopied] = useState(false);
  const [imgState, setImgState] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "error"; msg: string }
  >({ kind: "idle" });
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

  async function genImage() {
    setImgState({ kind: "loading" });
    try {
      const r = await fetch(`/api/drafts/${draft.id}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await r.json();
      if (!r.ok) {
        setImgState({ kind: "error", msg: d.error ?? "failed" });
      } else {
        onImage(d.draft);
        setImgState({ kind: "idle" });
      }
    } catch (e) {
      setImgState({
        kind: "error",
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function removeImage() {
    const r = await fetch(`/api/drafts/${draft.id}/image`, {
      method: "DELETE",
    });
    if (r.ok) {
      const d = await r.json();
      onImage(d.draft);
    }
  }

  const [tfState, setTfState] = useState<
    { kind: "idle" } | { kind: "sending" } | { kind: "err"; msg: string }
  >({ kind: "idle" });

  async function sendToTypefully() {
    setTfState({ kind: "sending" });
    try {
      const r = await fetch(`/api/drafts/${draft.id}/typefully`, {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) {
        setTfState({ kind: "err", msg: d.error ?? "failed" });
      } else {
        setTfState({ kind: "idle" });
        onImage(d.draft); // reuse the parent's draft-replace callback
      }
    } catch (e) {
      setTfState({
        kind: "err",
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  }

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

      <div className="mb-3">
        {draft.imageUrl ? (
          <div className="flex gap-3 items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${draft.imageUrl}?t=${draft.updatedAt}`}
              alt={draft.imagePrompt ?? "generated image"}
              className="h-32 rounded-md border border-border object-cover"
            />
            <div className="flex-1 min-w-0">
              {draft.imagePrompt && (
                <div
                  className="text-[11px] italic text-muted line-clamp-3 mb-2"
                  title={draft.imagePrompt}
                >
                  &ldquo;{draft.imagePrompt}&rdquo;
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={genImage}
                  disabled={imgState.kind === "loading"}
                  className="text-xs px-2.5 py-1 border border-border rounded hover:border-foreground disabled:opacity-40"
                >
                  {imgState.kind === "loading" ? "Generating…" : "Regenerate"}
                </button>
                <a
                  href={`${draft.imageUrl}?t=${draft.updatedAt}`}
                  download={`tweet-${draft.id}.jpg`}
                  className="text-xs px-2.5 py-1 border border-border rounded hover:border-foreground"
                >
                  Download
                </a>
                <button
                  onClick={removeImage}
                  className="text-xs px-2.5 py-1 text-muted hover:text-danger"
                >
                  Remove image
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={genImage}
              disabled={imgState.kind === "loading"}
              className="px-2.5 py-1 border border-dashed border-border rounded hover:border-accent hover:text-accent disabled:opacity-40"
            >
              {imgState.kind === "loading"
                ? "Generating image (5–8s)…"
                : "+ Generate image"}
            </button>
            {imgState.kind === "error" && (
              <span className="text-danger truncate" title={imgState.msg}>
                {imgState.msg}
              </span>
            )}
          </div>
        )}
      </div>

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
        {draft.typefullyUrl ? (
          <a
            href={draft.typefullyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2.5 py-1 bg-accent/15 text-accent border border-accent/40 rounded hover:bg-accent/25"
          >
            ✓ In Typefully ↗
          </a>
        ) : (
          <button
            onClick={sendToTypefully}
            disabled={tfState.kind === "sending"}
            title={tfState.kind === "err" ? tfState.msg : "Send to Typefully for team review"}
            className="text-xs px-2.5 py-1 border border-accent/40 text-accent rounded hover:bg-accent/10 disabled:opacity-40"
          >
            {tfState.kind === "sending"
              ? "Sending…"
              : tfState.kind === "err"
                ? "Retry → Typefully"
                : "↗ Send to Typefully"}
          </button>
        )}

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

      {tfState.kind === "err" && (
        <div className="mt-3 px-3 py-2 bg-danger/10 border border-danger/40 rounded-md text-xs text-danger flex items-center gap-2 flex-wrap">
          <span className="flex-1 min-w-0">{tfState.msg}</span>
          {/no typefully api key/i.test(tfState.msg) && (
            <Link
              href="/accounts"
              className="shrink-0 px-2 py-1 border border-danger/40 rounded hover:bg-danger/15 font-medium"
            >
              Add key in Accounts →
            </Link>
          )}
          <button
            onClick={() => setTfState({ kind: "idle" })}
            className="shrink-0 text-muted hover:text-foreground"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
