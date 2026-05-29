"use client";

import { useCallback, useEffect, useState } from "react";
import { NoAccount } from "@/components/NoAccount";
import { useAccount } from "@/lib/account-context";
import type { TargetAccount } from "@/lib/schema";

type Mode = "engage" | "monitor" | "amplify";

export default function TargetsPage() {
  const { currentId } = useAccount();
  const [targets, setTargets] = useState<TargetAccount[]>([]);
  const [handle, setHandle] = useState("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<Mode>("engage");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (currentId === null) return;
    const r = await fetch(`/api/targets?accountId=${currentId}`);
    const d = await r.json();
    setTargets(d.targets ?? []);
  }, [currentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const r = await fetch("/api/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: currentId,
        handle,
        notes,
        engagementMode: mode,
      }),
    });
    if (r.ok) {
      setHandle("");
      setNotes("");
      load();
    } else {
      const d = await r.json();
      setErr(d.error ?? "failed");
    }
  }

  async function updateMode(id: number, newMode: Mode) {
    await fetch(`/api/targets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engagementMode: newMode }),
    });
    setTargets((ts) =>
      ts.map((t) => (t.id === id ? { ...t, engagementMode: newMode } : t)),
    );
  }

  async function remove(id: number) {
    await fetch(`/api/targets/${id}`, { method: "DELETE" });
    setTargets((ts) => ts.filter((t) => t.id !== id));
  }

  if (currentId === null) return <NoAccount />;

  return (
    <div className="p-10 max-w-3xl">
      <h1 className="text-3xl font-semibold mb-1">Target Accounts</h1>
      <p className="text-muted mb-6">
        Accounts you want to engage with. In Manual Mode, this is a reference
        list — when their content lands on your feed, paste it into Generate.
      </p>

      <form
        onSubmit={add}
        className="bg-surface border border-border rounded-lg p-5 mb-8 space-y-3"
      >
        <div className="flex gap-3">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@handle"
            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="bg-background border border-border rounded-md px-3 py-2 text-sm"
          >
            <option value="engage">engage</option>
            <option value="monitor">monitor</option>
            <option value="amplify">amplify</option>
          </select>
        </div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="notes (optional) — e.g. competitor, founder, narrative-setter"
          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
        />
        <div className="flex justify-between items-center">
          {err ? (
            <span className="text-xs text-danger">{err}</span>
          ) : (
            <span className="text-xs text-muted">
              engage = reply + QRT &nbsp;·&nbsp; monitor = read-only &nbsp;·&nbsp;
              amplify = retweet bias
            </span>
          )}
          <button
            type="submit"
            disabled={!handle.trim()}
            className="px-4 py-2 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40"
          >
            Add target
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {targets.length === 0 ? (
          <div className="text-muted text-sm border border-dashed border-border rounded-lg p-6 text-center">
            No targets yet.
          </div>
        ) : (
          targets.map((t) => (
            <div
              key={t.id}
              className="bg-surface border border-border rounded-md p-4 flex items-center gap-3 group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={`https://x.com/${t.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:text-accent"
                  >
                    @{t.handle}
                  </a>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface-2 text-muted">
                    {t.engagementMode}
                  </span>
                </div>
                {t.notes && (
                  <div className="text-xs text-muted mt-1">{t.notes}</div>
                )}
              </div>
              <select
                value={t.engagementMode}
                onChange={(e) => updateMode(t.id, e.target.value as Mode)}
                className="bg-background border border-border rounded-md px-2 py-1 text-xs"
              >
                <option value="engage">engage</option>
                <option value="monitor">monitor</option>
                <option value="amplify">amplify</option>
              </select>
              <button
                onClick={() => remove(t.id)}
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
