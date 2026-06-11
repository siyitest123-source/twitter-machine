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
};

// Top-bar primary nav (4 visible). Everything else folds into the More menu.
const PRIMARY: Item[] = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/queue", label: "Queue", Icon: IconQueue },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
  { href: "/performance", label: "Performance", Icon: IconChart },
];

const MORE: { divider: string; items: Item[] }[] = [
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
      <span className="topbar-acct" style={{ color: "var(--muted)" }}>
        loading…
      </span>
    );
  }

  if (accounts.length === 0) {
    return (
      <Link
        href="/accounts"
        className="topbar-acct"
        style={{ color: "var(--accent-ink)" }}
      >
        <IconPlus size={14} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Create account</span>
      </Link>
    );
  }

  return (
    <div ref={ref} className="topbar-more">
      <button
        type="button"
        className="topbar-acct"
        onClick={() => setOpen((o) => !o)}
      >
        <div className={`acct-av ${avatarClass(current?.id ?? 0)}`}>
          {(current?.handle ?? "?")[0]?.toUpperCase()}
        </div>
        <span style={{ fontWeight: 600 }}>@{current?.handle}</span>
        <IconChevDown size={14} style={{ color: "var(--muted)" }} />
      </button>
      {open && (
        <div className="topbar-pop" style={{ right: 0 }}>
          <div className="side-label">Switch account</div>
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 6,
                fontSize: 13,
                color: "var(--ink-2)",
                background: a.id === currentId ? "var(--surface-2)" : "transparent",
                border: 0,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <div className={`acct-av ${avatarClass(a.id)}`} style={{ width: 22, height: 22, fontSize: 11 }}>
                {a.handle[0].toUpperCase()}
              </div>
              <span style={{ flex: 1 }}>@{a.handle}</span>
              {a.id === currentId && (
                <IconCheck size={14} style={{ color: "var(--accent)" }} />
              )}
            </button>
          ))}
          <div className="hr" style={{ margin: "6px 0" }} />
          <Link href="/accounts" onClick={() => setOpen(false)}>
            <IconSettings size={14} />
            <span>Manage accounts</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function MoreMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const anyActive = MORE.some((g) =>
    g.items.some((i) => pathname.startsWith(i.href)),
  );
  return (
    <div ref={ref} className="topbar-more">
      <button
        type="button"
        className="topbar-more-btn"
        onClick={() => setOpen((o) => !o)}
        style={
          anyActive
            ? { background: "var(--surface-2)", color: "var(--ink)" }
            : undefined
        }
      >
        More
        <IconChevDown size={13} />
      </button>
      {open && (
        <div className="topbar-pop" style={{ left: 0 }}>
          {MORE.map((g) => (
            <div key={g.divider}>
              <div className="side-label">{g.divider}</div>
              {g.items.map(({ href, label, Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    data-on={active}
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={15} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
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
    <header className="topbar">
      <Link href="/" className="topbar-brand">
        <span className="topbar-mark">F</span>
        <span>Factory</span>
      </Link>

      <nav className="topbar-nav">
        {PRIMARY.map(({ href, label, Icon }) => (
          <Link key={href} href={href} data-on={isActive(href)}>
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        ))}
        <MoreMenu pathname={pathname} />
      </nav>

      <div className="topbar-actions">
        <Link
          href="/create"
          className="topbar-cta"
          data-on={isActive("/create")}
        >
          <IconCreate size={15} />
          <span>Create</span>
          <span className="kbd">⌘K</span>
        </Link>
        <AccountSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
