"use client";

import { useCallback, useEffect, useState } from "react";
import { NoAccount } from "@/components/NoAccount";
import { useAccount } from "@/lib/account-context";
import type { VoiceSample } from "@/lib/schema";

export default function VoicePage() {
  const { currentId } = useAccount();
  const [samples, setSamples] = useState<VoiceSample[]>([]);
  const [bulk, setBulk] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  async function save() {
    const lines = bulk
      .split(/\n\n+|\n---+\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 4000);
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

  async function remove(id: number) {
    await fetch(`/api/voice/${id}`, { method: "DELETE" });
    setSamples((s) => s.filter((x) => x.id !== id));
  }

  if (currentId === null) return <NoAccount />;

  return (
    <div className="p-10 max-w-3xl">
      <h1 className="text-3xl font-semibold mb-1">Voice Training</h1>
      <p className="text-muted mb-6">
        Paste your past tweets, one per block. Separate blocks with a blank line
        or <code>---</code>. The generator uses 15 random samples as in-context
        examples per request.
      </p>

      <div className="bg-surface border border-border rounded-lg p-5 mb-8">
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={10}
          placeholder={`tweet one\n\ntweet two\n\ntweet three`}
          className="w-full bg-background border border-border rounded-md p-3 text-sm font-mono resize-y focus:outline-none focus:border-accent"
        />
        <div className="flex justify-between items-center mt-3">
          <div className="text-xs text-muted">
            {bulk
              .split(/\n\n+|\n---+\n/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0).length}{" "}
            blocks detected
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className="text-xs text-success">{msg}</span>}
            <button
              onClick={save}
              disabled={saving || bulk.trim().length === 0}
              className="px-4 py-2 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save samples"}
            </button>
          </div>
        </div>
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
            No samples yet. Paste your past tweets above.
          </div>
        ) : (
          samples.map((s) => (
            <div
              key={s.id}
              className="bg-surface border border-border rounded-md p-4 flex gap-3 group"
            >
              <div className="flex-1 whitespace-pre-wrap text-sm leading-relaxed">
                {s.text}
              </div>
              <button
                onClick={() => remove(s.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-danger px-2"
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
