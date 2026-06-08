"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { useAccount } from "@/lib/account-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  IconAccounts,
  IconCalendar,
  IconChart,
  IconChevDown,
  IconCheck,
  IconCompass,
  IconCreate,
  IconHome,
  IconPlus,
  IconQueue,
  IconSettings,
  IconSparkLine,
  IconTarget,
  IconVoice,
} from "@/components/Icons";

type Item = {
  href: string;
  label: string;
  Icon: (p: { size?: number }) => ReactElement;
  kbd?: string;
};
type Group = { divider?: string; items: Item[] };

const GROUPS: Group[] = [
  {
    items: [
      { href: "/", label: "Home", Icon: IconHome },
      { href: "/create", label: "Create", Icon: IconCreate, kbd: "⌘K" },
      { href: "/queue", label: "Queue", Icon: IconQueue },
      { href: "/calendar", label: "Calendar", Icon: IconCalendar },
      { href: "/performance", label: "Performance", Icon: IconChart },
    ],
  },
  {
    divider: "Power tools",
    items: [
      { href: "/discover", label: "Discover", Icon: IconCompass },
      { href: "/generate", label: "Generate (raw)", Icon: IconSparkLine },
      { href: "/plan", label: "Weekly plan (raw)", Icon: IconCalendar },
    ],
  },
  {
    divider: "Setup",
    items: [
      { href: "/accounts", label: "Accounts", Icon: IconAccounts },
      { href: "/targets", label: "Target accounts", Icon: IconTarget },
      { href: "/voice", label: "Voice training", Icon: IconVoice },
    ],
  },
];

function avatarClass(id: number) {
  return ["av-1", "av-2", "av-3"][id % 3];
}

function AccountSwitcher() {
  const { accounts, currentId, current, setCurrentId, loading } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (loading) {
    return (
      <div className="acct" style={{ color: "var(--muted)", fontSize: 13 }}>
        loading…
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Link
        href="/accounts"
        className="acct"
        style={{ justifyContent: "center", color: "var(--accent-ink)" }}
      >
        <IconPlus size={15} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Create first account</span>
      </Link>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="acct"
        onClick={() => setOpen((o) => !o)}
      >
        <div className={`acct-av ${avatarClass(current?.id ?? 0)}`}>
          {(current?.handle ?? "?")[0]?.toUpperCase()}
        </div>
        <div className="acct-meta">
          <div className="acct-handle">@{current?.handle}</div>
          <div className="acct-name">{current?.displayName ?? "—"}</div>
        </div>
        <IconChevDown size={15} style={{ color: "var(--muted)", flex: "none" }} />
      </button>
      {open && (
        <div className="acct-pop" style={{ top: "calc(100% + 6px)", left: 0, right: 0 }}>
          <div className="side-label" style={{ padding: "6px 10px" }}>
            Switch account
          </div>
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              className="acct-opt"
              data-on={a.id === currentId}
              onClick={() => {
                setCurrentId(a.id);
                setOpen(false);
              }}
            >
              <div className={`acct-av ${avatarClass(a.id)}`}>
                {a.handle[0].toUpperCase()}
              </div>
              <div className="acct-meta">
                <div className="acct-handle">@{a.handle}</div>
                <div className="acct-name">{a.displayName ?? "—"}</div>
              </div>
              {a.id === currentId && (
                <IconCheck size={15} style={{ color: "var(--accent)", flex: "none" }} />
              )}
            </button>
          ))}
          <div className="hr" style={{ margin: "6px 0" }} />
          <Link href="/accounts" className="acct-opt" style={{ color: "var(--ink-2)" }}>
            <span style={{ width: 30, display: "grid", placeItems: "center" }}>
              <IconSettings size={15} />
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>Manage accounts</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="brand" style={{ padding: "0 8px" }}>
        <div className="brand-mark">F</div>
        <div className="brand-name">
          Factory<small>Twitter studio</small>
        </div>
      </div>

      {/* Account switcher */}
      <AccountSwitcher />

      {/* Navigation groups */}
      {GROUPS.map((group, i) => (
        <div key={i} className="side-section">
          {group.divider && <div className="side-label">{group.divider}</div>}
          {group.items.map(({ href, label, Icon, kbd }) => (
            <Link
              key={href}
              href={href}
              className="nav-link"
              data-on={isActive(href)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {kbd && <span className="kbd">{kbd}</span>}
            </Link>
          ))}
        </div>
      ))}

      {/* Footer */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="hr" />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 4px",
          }}
        >
          <div
            className="eyebrow"
            style={{ display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}
          >
            <span className="dot" style={{ background: "var(--success)" }} />
            Manual mode
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
