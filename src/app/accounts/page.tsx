"use client";

import { useState } from "react";
import { useAccount } from "@/lib/account-context";
import type { Account } from "@/lib/schema";

export default function AccountsPage() {
  const { accounts, currentId, setCurrentId, refresh, loading } = useAccount();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [persona, setPersona] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setCreating(true);
    const r = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, displayName, persona }),
    });
    if (r.ok) {
      const d = await r.json();
      setHandle("");
      setDisplayName("");
      setPersona("");
      const list = await refresh();
      if (d.account?.id) setCurrentId(d.account.id);
      else if (list[0]) setCurrentId(list[0].id);
    } else {
      const d = await r.json();
      setErr(d.error ?? "failed");
    }
    setCreating(false);
  }

  return (
    <div className="p-10 max-w-3xl">
      <h1 className="text-3xl font-semibold mb-1">Accounts</h1>
      <p className="text-muted mb-6">
        Each account is an independent Twitter handle with its own voice
        samples, targets, drafts, calendar, and performance history. The persona
        is a short description of the account&apos;s role and tone, injected into
        every prompt on top of the voice samples.
      </p>

      <form
        onSubmit={create}
        className="bg-surface border border-border rounded-lg p-5 mb-8 space-y-3"
      >
        <div className="text-xs font-mono uppercase tracking-wider text-muted">
          New account
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@handle"
            className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name (optional)"
            className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <textarea
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          rows={3}
          placeholder="Persona (optional) — e.g. 'A DeFi protocol's official account. Technical but approachable. Bullish on its ecosystem, skeptical of hype. Never shills tokens.'"
          className="w-full bg-background border border-border rounded-md p-3 text-sm resize-y focus:outline-none focus:border-accent"
        />
        <div className="flex justify-between items-center">
          {err ? (
            <span className="text-xs text-danger">{err}</span>
          ) : (
            <span className="text-xs text-muted">
              Voice samples are added per-account on the Voice Training page.
            </span>
          )}
          <button
            type="submit"
            disabled={!handle.trim() || creating}
            className="px-4 py-2 bg-accent text-accent-fg rounded-md text-sm font-medium disabled:opacity-40"
          >
            {creating ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>

      <h2 className="text-sm font-mono uppercase tracking-wider text-muted mb-3">
        Accounts ({accounts.length})
      </h2>
      {loading ? (
        <div className="text-muted text-sm">Loading…</div>
      ) : accounts.length === 0 ? (
        <div className="text-muted text-sm border border-dashed border-border rounded-lg p-8 text-center">
          No accounts yet. Create one above.
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              isCurrent={a.id === currentId}
              onSelect={() => setCurrentId(a.id)}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AccountCard({
  account,
  isCurrent,
  onSelect,
  onChanged,
}: {
  account: Account;
  isCurrent: boolean;
  onSelect: () => void;
  onChanged: () => Promise<Account[]>;
}) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(account.displayName ?? "");
  const [persona, setPersona] = useState(account.persona ?? "");
  const [typefullyApiKey, setTypefullyApiKey] = useState(
    account.typefullyApiKey ?? "",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tfTest, setTfTest] = useState<
    | { kind: "idle" }
    | { kind: "testing" }
    | { kind: "ok"; socialSets: number }
    | { kind: "err"; msg: string }
  >({ kind: "idle" });

  async function save() {
    await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        persona,
        typefullyApiKey: typefullyApiKey.trim() || null,
      }),
    });
    setEditing(false);
    onChanged();
  }

  async function testTypefully() {
    setTfTest({ kind: "testing" });
    try {
      const r = await fetch(
        `/api/accounts/${account.id}/typefully/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: typefullyApiKey.trim() || undefined }),
        },
      );
      const d = await r.json();
      if (r.ok && d.ok)
        setTfTest({ kind: "ok", socialSets: d.socialSets ?? 0 });
      else setTfTest({ kind: "err", msg: d.error ?? "failed" });
    } catch (e) {
      setTfTest({
        kind: "err",
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function remove() {
    await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div
      className={`bg-surface border rounded-lg p-4 ${isCurrent ? "border-accent" : "border-border"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <a
          href={`https://x.com/${account.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:text-accent"
        >
          @{account.handle}
        </a>
        {account.displayName && (
          <span className="text-sm text-muted">{account.displayName}</span>
        )}
        {isCurrent ? (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent ml-auto">
            active
          </span>
        ) : (
          <button
            onClick={onSelect}
            className="text-xs text-muted hover:text-foreground ml-auto"
          >
            Switch to this
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={3}
            placeholder="Persona / tone"
            className="w-full bg-background border border-border rounded-md p-3 text-sm resize-y focus:outline-none focus:border-accent"
          />
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-muted mb-1.5 mt-1">
              Typefully API key (optional)
            </label>
            <div className="flex gap-2">
              <input
                value={typefullyApiKey}
                onChange={(e) => {
                  setTypefullyApiKey(e.target.value);
                  setTfTest({ kind: "idle" });
                }}
                type="password"
                placeholder="Pro plan required · Typefully → Settings → API"
                className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
              />
              <button
                onClick={testTypefully}
                disabled={
                  !typefullyApiKey.trim() || tfTest.kind === "testing"
                }
                className="px-3 py-2 text-xs border border-border rounded-md hover:border-foreground disabled:opacity-40"
              >
                {tfTest.kind === "testing" ? "Testing…" : "Test"}
              </button>
            </div>
            <div className="mt-1.5 text-xs min-h-[1.25rem]">
              {tfTest.kind === "ok" && (
                <span className="text-success">
                  ✓ Connection works — {tfTest.socialSets} connected account
                  {tfTest.socialSets === 1 ? "" : "s"} reachable.
                </span>
              )}
              {tfTest.kind === "err" && (
                <span className="text-danger">{tfTest.msg}</span>
              )}
              {tfTest.kind === "idle" && (
                <span className="text-muted">
                  Used to send approved drafts to Typefully for team review
                  before publishing to X.
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              className="px-3 py-1.5 bg-accent text-accent-fg rounded-md text-sm"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 border border-border rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-sm text-muted mb-3 whitespace-pre-wrap">
            {account.persona || (
              <span className="italic">No persona set.</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-2.5 py-1 border border-border rounded hover:border-foreground"
            >
              Edit
            </button>
            {confirmDelete ? (
              <>
                <button
                  onClick={remove}
                  className="text-xs px-2.5 py-1 bg-danger/15 text-danger border border-danger/40 rounded"
                >
                  Delete everything for @{account.handle}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2.5 py-1 border border-border rounded"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs px-2.5 py-1 text-muted hover:text-danger ml-auto"
              >
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
