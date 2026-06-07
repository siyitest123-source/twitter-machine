"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/lib/account-context";

export type CreateFormMode = "chat" | "compact";

export type ContentType = "single" | "reply" | "plan" | "trends";
export type Format = "tweet" | "thread" | "auto";

const TYPE_LABEL: Record<ContentType, string> = {
  single: "Single content",
  reply: "Reply / QRT a tweet",
  plan: "Weekly plan",
  trends: "Trend surf",
};
const TYPE_DESC: Record<ContentType, string> = {
  single: "One tweet or one thread, generated from your brief.",
  reply: "React to a tweet from your target list with your take.",
  plan: "A calendar of posts laid out across the week.",
  trends: "Cluster recent tweets into narratives + ideas.",
};

const FORMAT_LABEL: Record<Format, string> = {
  tweet: "Single tweet",
  thread: "Thread",
  auto: "Let it decide",
};

function todayISO(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

type Result =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "saved"; count: number; href: string; label: string }
  | { kind: "redirect"; href: string; label: string }
  | { kind: "skipped"; reason: string }
  | { kind: "error"; msg: string };

export function CreateForm({
  mode = "chat",
  onClose,
}: {
  mode?: CreateFormMode;
  onClose?: () => void;
}) {
  const router = useRouter();
  const { currentId, current } = useAccount();

  const [contentType, setContentType] = useState<ContentType>("single");
  const [format, setFormat] = useState<Format>("auto");
  const [brief, setBrief] = useState("");
  const [requirements, setRequirements] = useState("");

  // Reply / QRT fields
  const [sourceHandle, setSourceHandle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");

  // Weekly plan fields
  const [startDate, setStartDate] = useState(todayISO());
  const [days, setDays] = useState(7);
  const [postsPerDay, setPostsPerDay] = useState(3);

  const [numCandidates, setNumCandidates] = useState(3);

  const [result, setResult] = useState<Result>({ kind: "idle" });

  const briefRef = useRef<HTMLTextAreaElement | null>(null);

  // Chat-mode progressive state
  const briefRequired = contentType !== "trends";
  const briefReady = brief.trim().length > 0;
  const sourceReady = contentType !== "reply" || sourceText.trim().length > 0;
  const ready = currentId !== null && briefReady && sourceReady;

  function resolveType(): "original" | "thread" | "reply" | "qrt" {
    if (contentType === "reply") {
      if (format === "thread") return "thread";
      // user picks reply or qrt via a separate sub-format; default reply
      return format === "tweet" ? "reply" : "reply";
    }
    if (contentType === "single") {
      return format === "thread" ? "thread" : "original";
    }
    return "original";
  }

  async function submit() {
    if (!ready) return;
    setResult({ kind: "loading" });

    try {
      if (contentType === "trends") {
        // Trend surf is a different shape — redirect to /discover with brief prefilled
        const params = new URLSearchParams();
        if (brief) params.set("brief", brief);
        router.push(`/discover${params.toString() ? `?${params}` : ""}`);
        onClose?.();
        return;
      }

      if (contentType === "plan") {
        const r = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: currentId,
            brief: brief.trim(),
            requirements: requirements.trim() || undefined,
            postsPerDay,
            daysInWeek: days,
            startDateISO: startDate,
            saveAsDrafts: true,
          }),
        });
        const d = await r.json();
        if (!r.ok) {
          setResult({ kind: "error", msg: d.error ?? "failed" });
          return;
        }
        const count = d.saved?.length ?? 0;
        setResult({
          kind: "saved",
          count,
          href: "/calendar",
          label: `${count} posts scheduled · open Calendar`,
        });
        return;
      }

      // single OR reply → /api/generate
      const apiType = resolveType();
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: currentId,
          type: apiType,
          topic: contentType === "single" ? brief.trim() : undefined,
          brief: requirements.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          sourceText: sourceText.trim() || undefined,
          sourceHandle: sourceHandle.trim() || undefined,
          numCandidates,
          saveAsDrafts: true,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setResult({ kind: "error", msg: d.error ?? "failed" });
        return;
      }
      if (d.skippedReason) {
        setResult({ kind: "skipped", reason: d.skippedReason });
        return;
      }
      const count = d.saved?.length ?? 0;
      setResult({
        kind: "saved",
        count,
        href: "/queue",
        label: `${count} candidates saved · open Queue`,
      });
    } catch (e) {
      setResult({
        kind: "error",
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Cmd/Ctrl+Enter submits
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && ready) {
        e.preventDefault();
        submit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, contentType, brief, requirements, sourceText]);

  function reset() {
    setBrief("");
    setRequirements("");
    setSourceHandle("");
    setSourceUrl("");
    setSourceText("");
    setResult({ kind: "idle" });
  }

  // ============================================================
  // CHAT MODE
  // ============================================================
  if (mode === "chat") {
    return (
      <div className="flex flex-col gap-3">
        {/* Step 1: type */}
        <Bubble side="sys">
          <div className="mb-2">
            What are we making for{" "}
            <span className="font-semibold">
              @{current?.handle ?? "—"}
            </span>{" "}
            today?
          </div>
          <ChipRow>
            {(Object.keys(TYPE_LABEL) as ContentType[]).map((t) => (
              <Chip
                key={t}
                selected={contentType === t}
                onClick={() => {
                  setContentType(t);
                  setResult({ kind: "idle" });
                }}
                title={TYPE_DESC[t]}
              >
                {TYPE_LABEL[t]}
              </Chip>
            ))}
          </ChipRow>
        </Bubble>
        <Bubble side="usr">{TYPE_LABEL[contentType]}</Bubble>

        {/* Step 2: format OR source OR schedule (depending on type) */}
        {contentType === "single" && (
          <>
            <Bubble side="sys">
              <div className="mb-2">Format?</div>
              <ChipRow>
                {(Object.keys(FORMAT_LABEL) as Format[]).map((f) => (
                  <Chip
                    key={f}
                    selected={format === f}
                    onClick={() => setFormat(f)}
                  >
                    {FORMAT_LABEL[f]}
                  </Chip>
                ))}
              </ChipRow>
            </Bubble>
            <Bubble side="usr">{FORMAT_LABEL[format]}</Bubble>
          </>
        )}

        {contentType === "reply" && (
          <Bubble side="sys">
            <div className="mb-3">Paste the tweet you want to react to.</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                value={sourceHandle}
                onChange={(e) => setSourceHandle(e.target.value)}
                placeholder="@handle (e.g. cobie)"
                className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="tweet URL (optional)"
                className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={4}
              placeholder="Tweet text"
              className="w-full bg-background border border-border rounded-md p-3 text-sm resize-y focus:outline-none focus:border-accent"
            />
            <div className="mt-3 flex gap-2 items-center">
              <span className="text-xs text-muted">Format:</span>
              <ChipRow>
                {(["tweet", "thread", "auto"] as Format[]).map((f) => (
                  <Chip
                    key={f}
                    selected={format === f}
                    onClick={() => setFormat(f)}
                  >
                    {f === "tweet" ? "Reply" : f === "thread" ? "Reply thread" : "Let it decide"}
                  </Chip>
                ))}
              </ChipRow>
            </div>
          </Bubble>
        )}

        {contentType === "plan" && (
          <Bubble side="sys">
            <div className="mb-3">When and how often?</div>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Start
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Days
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground"
                >
                  {[3, 5, 7, 14].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Posts/day
                <select
                  value={postsPerDay}
                  onChange={(e) => setPostsPerDay(Number(e.target.value))}
                  className="bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Bubble>
        )}

        {/* Step 3: brief */}
        {briefRequired && (
          <Bubble side="sys" active>
            <div className="mb-3">
              Got it. <span className="font-semibold">Brief me.</span>{" "}
              {contentType === "plan"
                ? "What's the story this week?"
                : contentType === "reply"
                  ? "What's the angle for your reply?"
                  : "What's this about, what's the hook?"}
            </div>
            <ComposeBox
              briefRef={briefRef}
              brief={brief}
              requirements={requirements}
              setBrief={setBrief}
              setRequirements={setRequirements}
              loading={result.kind === "loading"}
              ready={ready}
              onSubmit={submit}
              candidateCount={numCandidates}
              setCandidateCount={setNumCandidates}
              showCandidatePicker={contentType === "single" || contentType === "reply"}
            />
          </Bubble>
        )}

        {contentType === "trends" && (
          <Bubble side="sys" active>
            <div className="mb-2">
              Trend surf needs a feed of recent tweets to cluster. Open the
              Discover page to paste them in.
            </div>
            <button
              onClick={submit}
              className="px-3 py-1.5 bg-accent text-accent-fg rounded-md text-sm font-medium"
            >
              Open Discover →
            </button>
          </Bubble>
        )}

        {/* Result */}
        {result.kind !== "idle" && contentType !== "trends" && (
          <ResultCard result={result} onReset={reset} onClose={onClose} />
        )}
      </div>
    );
  }

  // ============================================================
  // COMPACT MODE (palette / modal)
  // ============================================================
  return (
    <div className="flex flex-col">
      <div className="px-5 py-4 border-b border-border">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
          Content type
        </div>
        <ChipRow>
          {(Object.keys(TYPE_LABEL) as ContentType[]).map((t) => (
            <Chip
              key={t}
              selected={contentType === t}
              onClick={() => setContentType(t)}
            >
              {TYPE_LABEL[t]}
            </Chip>
          ))}
        </ChipRow>
      </div>

      {contentType !== "plan" && contentType !== "trends" && (
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
            Format
          </div>
          <ChipRow>
            {(["tweet", "thread", "auto"] as Format[]).map((f) => (
              <Chip
                key={f}
                selected={format === f}
                onClick={() => setFormat(f)}
              >
                {contentType === "reply" && f === "tweet"
                  ? "Reply"
                  : contentType === "reply" && f === "thread"
                    ? "Reply thread"
                    : FORMAT_LABEL[f]}
              </Chip>
            ))}
          </ChipRow>
        </div>
      )}

      {contentType === "reply" && (
        <div className="px-5 py-4 border-b border-border space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted">
            Source tweet
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={sourceHandle}
              onChange={(e) => setSourceHandle(e.target.value)}
              placeholder="@handle"
              className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="URL (optional)"
              className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            rows={3}
            placeholder="Tweet text"
            className="w-full bg-background border border-border rounded-md p-3 text-sm resize-y focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {contentType === "plan" && (
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
            Schedule
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted">
              Start
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted">
              Days
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground"
              >
                {[3, 5, 7, 14].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted">
              Posts/day
              <select
                value={postsPerDay}
                onChange={(e) => setPostsPerDay(Number(e.target.value))}
                className="bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {briefRequired && (
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
            Brief
          </div>
          <textarea
            ref={briefRef}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            placeholder={
              contentType === "plan"
                ? "What's the week's story? Themes, launches, things to ride."
                : contentType === "reply"
                  ? "What's your angle? What take should the reply land?"
                  : "What's this about? What's the hook?"
            }
            className="w-full bg-background border border-border rounded-md p-3 text-sm resize-y focus:outline-none focus:border-accent"
          />
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted mt-3 mb-2">
            Comments / requirements (optional)
          </div>
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            rows={2}
            placeholder="Tone, things to avoid, constraints…"
            className="w-full bg-background border border-border rounded-md p-3 text-sm resize-y focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {contentType === "trends" && (
        <div className="px-5 py-4 border-b border-border text-sm text-muted">
          Trend surf needs a feed of tweets — open Discover to paste them in.
        </div>
      )}

      <div className="px-5 py-3 bg-surface flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted">
          Writing in{" "}
          <span className="text-foreground">@{current?.handle ?? "—"}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted">
          <span>
            <kbd className="px-1 py-px border border-border rounded bg-background mr-0.5">⌘</kbd>
            <kbd className="px-1 py-px border border-border rounded bg-background">↵</kbd>{" "}
            {contentType === "trends" ? "open Discover" : "generate"}
          </span>
          {onClose && (
            <span>
              <kbd className="px-1 py-px border border-border rounded bg-background">esc</kbd>{" "}
              close
            </span>
          )}
          <button
            onClick={submit}
            disabled={!ready || result.kind === "loading"}
            className="px-3 py-1.5 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40"
          >
            {result.kind === "loading"
              ? "Working…"
              : contentType === "trends"
                ? "Open Discover →"
                : "Generate"}
          </button>
        </div>
      </div>

      {result.kind !== "idle" && contentType !== "trends" && (
        <div className="px-5 py-3 border-t border-border">
          <ResultCard result={result} onReset={reset} onClose={onClose} inline />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Internal pieces
// ============================================================

function Bubble({
  side,
  active,
  children,
}: {
  side: "sys" | "usr";
  active?: boolean;
  children: React.ReactNode;
}) {
  if (side === "usr") {
    return (
      <div className="flex justify-end">
        <div className="bg-surface-2 border border-border rounded-2xl px-4 py-2 text-sm max-w-[84%]">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div
        className={`bg-surface border ${active ? "border-accent/40" : "border-border"} rounded-2xl px-4 py-3 text-sm max-w-[92%] ${active ? "shadow-[inset_3px_0_0_var(--color-accent)]" : ""}`}
        style={{ borderLeftWidth: 3, borderLeftColor: "var(--color-accent)" }}
      >
        {children}
      </div>
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-1.5 flex-wrap">{children}</div>;
}

function Chip({
  selected,
  onClick,
  title,
  children,
}: {
  selected?: boolean;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
        selected
          ? "bg-accent text-accent-fg border-accent font-medium"
          : "bg-surface border-border text-foreground hover:border-muted"
      }`}
    >
      {children}
    </button>
  );
}

function ComposeBox({
  briefRef,
  brief,
  requirements,
  setBrief,
  setRequirements,
  loading,
  ready,
  onSubmit,
  candidateCount,
  setCandidateCount,
  showCandidatePicker,
}: {
  briefRef: React.RefObject<HTMLTextAreaElement | null>;
  brief: string;
  requirements: string;
  setBrief: (s: string) => void;
  setRequirements: (s: string) => void;
  loading: boolean;
  ready: boolean;
  onSubmit: () => void;
  candidateCount: number;
  setCandidateCount: (n: number) => void;
  showCandidatePicker: boolean;
}) {
  return (
    <div className="bg-background border border-border rounded-xl p-3 mt-1">
      <textarea
        ref={briefRef}
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={4}
        placeholder="Free-form. Be specific — angle, hook, what to name."
        className="w-full bg-transparent border-0 text-sm resize-none focus:outline-none placeholder:italic placeholder:text-muted"
      />
      <textarea
        value={requirements}
        onChange={(e) => setRequirements(e.target.value)}
        rows={2}
        placeholder="Optional: tone, constraints, things to avoid"
        className="w-full bg-transparent border-0 text-sm resize-none focus:outline-none placeholder:italic placeholder:text-muted mt-1"
      />
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted">
          {showCandidatePicker && (
            <span className="flex items-center gap-1.5">
              Candidates:
              <select
                value={candidateCount}
                onChange={(e) => setCandidateCount(Number(e.target.value))}
                className="bg-background border border-border rounded px-1.5 py-0.5 text-[11px]"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </span>
          )}
          <span>
            <kbd className="px-1 py-px border border-border rounded">⌘</kbd>
            <kbd className="px-1 py-px border border-border rounded ml-0.5">↵</kbd>{" "}
            to send
          </span>
        </div>
        <button
          onClick={onSubmit}
          disabled={!ready || loading}
          className="px-4 py-1.5 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40"
        >
          {loading ? "Working…" : "Generate"}
        </button>
      </div>
    </div>
  );
}

function ResultCard({
  result,
  onReset,
  onClose,
  inline,
}: {
  result: Result;
  onReset: () => void;
  onClose?: () => void;
  inline?: boolean;
}) {
  if (result.kind === "loading") {
    return (
      <div
        className={`${inline ? "" : "bg-surface border border-border rounded-xl px-4 py-3 mt-2"} text-sm text-muted`}
      >
        Working in your voice…
      </div>
    );
  }
  if (result.kind === "error") {
    return (
      <div
        className={`${inline ? "" : "bg-surface border border-danger rounded-xl px-4 py-3 mt-2"} text-sm text-danger`}
      >
        {result.msg}
      </div>
    );
  }
  if (result.kind === "skipped") {
    return (
      <div
        className={`${inline ? "" : "bg-surface border border-border rounded-xl px-4 py-3 mt-2"} text-sm`}
      >
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1">
          Skipped
        </div>
        {result.reason}
      </div>
    );
  }
  if (result.kind === "saved") {
    return (
      <div
        className={`${inline ? "" : "bg-surface border border-success/40 rounded-xl px-4 py-3 mt-2"} text-sm flex items-center justify-between gap-3`}
      >
        <span>
          <span className="text-success font-medium">{result.count}</span>{" "}
          {result.count === 1 ? "draft" : "drafts"} saved.
        </span>
        <div className="flex gap-2">
          <a
            href={result.href}
            onClick={onClose}
            className="text-xs px-2.5 py-1 bg-accent text-accent-fg rounded-md font-medium"
          >
            {result.label}
          </a>
          <button
            onClick={onReset}
            className="text-xs px-2.5 py-1 border border-border rounded-md hover:border-foreground"
          >
            Make another
          </button>
        </div>
      </div>
    );
  }
  return null;
}
