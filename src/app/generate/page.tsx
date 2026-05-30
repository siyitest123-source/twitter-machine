"use client";

import { useState } from "react";
import { NoAccount } from "@/components/NoAccount";
import { useAccount } from "@/lib/account-context";

type Candidate = {
  text: string;
  thread_continuation: string[] | null;
  angle: string;
};
type Mode = "reply" | "qrt" | "original" | "thread";

const MODE_LABEL: Record<Mode, string> = {
  reply: "Reply",
  qrt: "Quote-retweet",
  original: "Original",
  thread: "Thread",
};

export default function GeneratePage() {
  const { currentId } = useAccount();
  const [mode, setMode] = useState<Mode>("reply");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceHandle, setSourceHandle] = useState("");
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState("");
  const [numCandidates, setNumCandidates] = useState(3);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const usesSource = mode === "reply" || mode === "qrt";

  async function generate() {
    setLoading(true);
    setErr(null);
    setSkipped(null);
    setCandidates([]);
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: currentId,
          type: mode,
          sourceUrl: sourceUrl || undefined,
          sourceText: sourceText || undefined,
          sourceHandle: sourceHandle || undefined,
          topic: topic || undefined,
          brief: brief.trim() || undefined,
          numCandidates,
          saveAsDrafts: true,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error ?? "failed");
      } else if (d.skippedReason) {
        setSkipped(d.skippedReason);
      } else {
        setCandidates(d.candidates ?? []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }

  const ready =
    (usesSource ? sourceText.trim().length > 0 : topic.trim().length > 0) &&
    currentId !== null;

  if (currentId === null) return <NoAccount />;

  return (
    <div className="p-10 max-w-3xl">
      <h1 className="text-3xl font-semibold mb-1">Generate</h1>
      <p className="text-muted mb-6">
        Paste a tweet from your target list (or compose an original or thread).
        Candidates are saved to the Approval Queue.
      </p>

      <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {(["reply", "qrt", "original", "thread"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                mode === m
                  ? "bg-accent text-accent-fg border-accent"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        {!usesSource ? (
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">
              {mode === "thread" ? "Thread topic" : "Topic / angle"}
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                mode === "thread"
                  ? "e.g. why the next restaking cycle will compress everyone's yield"
                  : "e.g. why restaking yields are about to compress"
              }
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">
                  Source @handle
                </label>
                <input
                  value={sourceHandle}
                  onChange={(e) => setSourceHandle(e.target.value)}
                  placeholder="e.g. cobie"
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">
                  Tweet URL (optional)
                </label>
                <input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://x.com/…"
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">
                Source tweet text
              </label>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={5}
                placeholder="Paste the tweet you want to react to"
                className="w-full bg-background border border-border rounded-md p-3 text-sm resize-y focus:outline-none focus:border-accent"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">
            Comments / requirements for the content (optional)
          </label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder={
              mode === "thread"
                ? "e.g. lead with a contrarian hook, keep total under 5 tweets, end with a question, no emojis"
                : "e.g. be skeptical, add a data point, keep it under 200 chars, don't mention competitor names"
            }
            className="w-full bg-background border border-border rounded-md p-3 text-sm resize-y focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Candidates:</span>
            <select
              value={numCandidates}
              onChange={(e) => setNumCandidates(Number(e.target.value))}
              className="bg-background border border-border rounded-md px-2 py-1 text-sm"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={generate}
            disabled={loading || !ready}
            className="px-4 py-2 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>

      {err && (
        <div className="mt-4 p-4 bg-surface border border-danger rounded-md text-sm text-danger">
          {err}
        </div>
      )}
      {skipped && (
        <div className="mt-4 p-4 bg-surface border border-border rounded-md text-sm">
          <div className="text-xs font-mono uppercase tracking-wider text-muted mb-1">
            Skipped
          </div>
          {skipped}
        </div>
      )}

      {candidates.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted mb-3">
            Candidates (saved to queue)
          </h2>
          <div className="space-y-3">
            {candidates.map((c, i) => (
              <CandidateCard key={i} candidate={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const [copied, setCopied] = useState(false);
  const len = candidate.text.length;
  const thread = candidate.thread_continuation ?? [];
  const isThread = thread.length > 0;

  async function copyAll() {
    const all = isThread
      ? [candidate.text, ...thread].join("\n\n---\n\n")
      : candidate.text;
    await navigator.clipboard.writeText(all);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-surface border border-border rounded-md p-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface-2 text-muted">
          {candidate.angle}
        </span>
        {isThread && (
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent">
            thread · {thread.length + 1}
          </span>
        )}
        <span
          className={`text-xs ml-auto ${len > 280 ? "text-danger" : "text-muted"}`}
        >
          {len}/280
        </span>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed mb-3">
        {candidate.text}
      </div>
      {isThread && (
        <ol className="mb-3 space-y-2 text-sm leading-relaxed">
          {thread.map((t, i) => (
            <li
              key={i}
              className="pl-3 border-l-2 border-border whitespace-pre-wrap"
            >
              <span className="text-xs text-muted mr-2 font-mono">
                {String(i + 2).padStart(2, "0")}
              </span>
              {t}
              <span
                className={`ml-2 text-xs ${t.length > 280 ? "text-danger" : "text-muted"}`}
              >
                ({t.length}/280)
              </span>
            </li>
          ))}
        </ol>
      )}
      <button
        onClick={copyAll}
        className="text-xs px-2.5 py-1 border border-border rounded hover:border-accent"
      >
        {copied ? "Copied!" : isThread ? "Copy thread" : "Copy"}
      </button>
    </div>
  );
}
