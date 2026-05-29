"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "@/lib/account-context";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/generate", label: "Generate" },
  { href: "/discover", label: "Discover Trends" },
  { href: "/plan", label: "Weekly Plan" },
  { href: "/calendar", label: "Calendar" },
  { href: "/queue", label: "Approval Queue" },
  { href: "/performance", label: "Performance" },
  { href: "/targets", label: "Target Accounts" },
  { href: "/voice", label: "Voice Training" },
];

export function Nav() {
  const pathname = usePathname();
  const { accounts, currentId, setCurrentId, loading } = useAccount();

  return (
    <nav className="w-56 shrink-0 border-r border-border bg-surface px-3 py-6 flex flex-col">
      <div className="px-3 mb-5">
        <div className="text-sm font-mono text-muted tracking-wider">
          TWITTER
        </div>
        <div className="text-lg font-semibold">Factory</div>
      </div>

      {/* Account switcher */}
      <div className="px-3 mb-5">
        <label className="block text-[10px] font-mono uppercase tracking-wider text-muted mb-1.5">
          Account
        </label>
        {loading ? (
          <div className="text-xs text-muted">loading…</div>
        ) : accounts.length === 0 ? (
          <Link
            href="/accounts"
            className="block text-xs text-accent hover:underline"
          >
            + Create your first account
          </Link>
        ) : (
          <div className="flex gap-1.5">
            <select
              value={currentId ?? ""}
              onChange={(e) => setCurrentId(Number(e.target.value))}
              className="flex-1 min-w-0 bg-background border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.handle}
                </option>
              ))}
            </select>
            <Link
              href="/accounts"
              title="Manage accounts"
              className="px-2 py-1.5 border border-border rounded-md text-sm text-muted hover:text-foreground hover:border-foreground"
            >
              ⚙
            </Link>
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-1">
        {LINKS.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-6 px-3 text-xs text-muted leading-relaxed">
        <span className="block font-mono uppercase tracking-wider mb-1">
          Mode
        </span>
        Manual — paste in, copy out. No X API connected.
      </div>
    </nav>
  );
}
