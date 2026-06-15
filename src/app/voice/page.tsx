"use client";

import { useCallback, useEffect, useState } from "react";
import { NoAccount } from "@/components/NoAccount";
import { useAccount } from "@/lib/account-context";
import type { VoiceSample } from "@/lib/schema";

type Mode = "text" | "links";

export default function VoicePage() {
  const { currentId } = useAccount();
  const [samples, setSamples] = useState<VoiceSample[]>([]);
  const [mode, setMode] = useState<Mode>("text");
  const [bulk, setBulk] = useState("");
  const [links, setLinks] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [failures, setFailures] = useState<{ input: string; error: string }[]>(
    [],
  );

  const load = useCallback(async () => {
    if (currentId === null) return;
    setLoading(true);
    const r = await fetch(`/api/voice?accountId=${currentId}`);
    const d = await r.json();
    setSamples(d.samples ?? []);
    setLoading(false);
  }, [currentId]);

  useEffect(() => {
    load();
  }, [load]);

  function blocksFromText(): string[] {
    return bulk
      .split(/\n\n+|\n---+\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 4000);
  }

  async function saveText() {
    const lines = blocksFromText();
    if (lines.length === 0) return;
    setSaving(true);
    setMsg(null);
    const r = await fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: currentId,
        samples: lines.map((text) => ({ text })),
      }),
    });
    if (r.ok) {
      const d = await r.json();
      setBulk("");
      setMsg(`Added ${d.inserted} samples.`);
      load();
    } else {
      setMsg("Save failed.");
    }
    setSaving(false);
  }

  // Links mode: fetch URLs → text → save in one go.
  async function fetchAndSaveLinks() {
    const urls = links
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length === 0) return;
    setFetching(true);
    setMsg(null);
    setFailures([]);
    try {
      const r = await fetch("/api/voice/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error ?? "fetch failed");
        setFetching(false);
        return;
      }
      const resolved: { id: string; text: string; handle: string | null }[] =
        d.resolved ?? [];
      setFailures(d.failed ?? []);

      if (resolved.length === 0) {
        setMsg("No tweets could be fetched.");
        setFetching(false);
        return;
      }

      // Save resolved text straight to voice samples, tagging the source.
      const save = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: currentId,
          samples: resolved.map((t) => ({
            text: t.text,
            context: t.handle ? `@${t.handle}` : "from link",
          })),
        }),
      });
      if (save.ok) {
        const sd = await save.json();
        setMsg(
          `Added ${sd.inserted} from links${(d.failed ?? []).length ? ` · ${d.failed.length} failed` : ""}.`,
        );
        setLinks("");
        load();
      } else {
        setMsg("Fetched, but save failed.");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
    setFetching(false);
  }

  async function remove(id: number) {
    await fetch(`/api/voice/${id}`, { method: "DELETE" });
    setSamples((s) => s.filter((x) => x.id !== id));
  }

  if (currentId === null) return <NoAccount />;

  const linkCount = links
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;

  return (
    <div className="p-10 max-w-3xl">
      <h1 className="text-3xl font-semibold mb-1">Voice Training</h1>
      <p className="text-muted mb-6">
        Teach the generator how this account sounds. Paste tweet text directly,
        or paste links and let it fetch them. The generator uses 15 random
        samples as in-context examples per request.
      </p>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        {(["text", "links"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setMsg(null);
              setFailures([]);
            }}
            className={`px-3 py-1.5 text-sm rounded-md border ${
              mode === m
                ? "bg-accent text-accent-fg border-accent"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {m === "text" ? "Paste text" : "Paste links"}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-lg p-5 mb-8">
        {mode === "text" ? (
          <>
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={10}
              placeholder={`tweet one\n\ntweet two\n\ntweet three`}
              className="w-full bg-background border border-border rounded-md p-3 text-sm font-mono resize-y focus:outline-none focus:border-accent"
            />
            <div className="flex justify-between items-center mt-3">
              <div className="text-xs text-muted">
                {blocksFromText().length} blocks detected
              </div>
              <div className="flex items-center gap-3">
                {msg && <span className="text-xs text-success">{msg}</span>}
                <button
                  onClick={saveText}
                  disabled={saving || bulk.trim().length === 0}
                  className="px-4 py-2 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving…" : "Save samples"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <textarea
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              rows={8}
              placeholder={`https://x.com/yourhandle/status/1234567890\nhttps://x.com/yourhandle/status/2345678901\n…one link per line`}
              className="w-full bg-background border border-border rounded-md p-3 text-sm font-mono resize-y focus:outline-none focus:border-accent"
            />
            <div className="flex justify-between items-center mt-3">
              <div className="text-xs text-muted">
                {linkCount} link{linkCount === 1 ? "" : "s"} · public tweets only
              </div>
              <div className="flex items-center gap-3">
                {msg && <span className="text-xs text-success">{msg}</span>}
                <button
                  onClick={fetchAndSaveLinks}
                  disabled={fetching || linkCount === 0}
                  className="px-4 py-2 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {fetching ? "Fetching…" : "Fetch & save"}
                </button>
              </div>
            </div>
            {failures.length > 0 && (
              <div className="mt-3 text-xs text-danger">
                <div className="font-medium mb-1">
                  {failures.length} couldn&apos;t be fetched:
                </div>
                <ul className="space-y-0.5">
                  {failures.slice(0, 8).map((f, i) => (
                    <li key={i} className="truncate">
                      {f.input} — {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 text-[11px] text-muted leading-relaxed">
              Links are read via Twitter&apos;s public embed endpoint — no
              login, nothing tied to your account. Protected or deleted tweets
              can&apos;t be fetched; paste their text instead.
            </p>
          </>
        )}
      </div>

      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted">
          Saved samples ({samples.length})
        </h2>
        {samples.length < 30 && samples.length > 0 && (
          <span className="text-xs text-muted">
            add {30 - samples.length} more for sharper output
          </span>
        )}
      </div>
      <div className="space-y-2">
        {loading ? (
          <div className="text-muted text-sm">Loading…</div>
        ) : samples.length === 0 ? (
          <div className="text-muted text-sm border border-dashed border-border rounded-lg p-6 text-center">
            No samples yet. Paste your past tweets (or their links) above.
          </div>
        ) : (
          samples.map((s) => (
            <div
              key={s.id}
              className="bg-surface border border-border rounded-md p-4 flex gap-3 group"
            >
              <div className="flex-1 min-w-0">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {s.text}
                </div>
                {s.context && (
                  <div className="text-[11px] text-muted mt-1.5 font-mono">
                    {s.context}
                  </div>
                )}
              </div>
              <button
                onClick={() => remove(s.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-danger px-2 shrink-0"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
