"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  return (
    <nav className="w-56 shrink-0 border-r border-border bg-surface px-3 py-6">
      <div className="px-3 mb-6">
        <div className="text-sm font-mono text-muted tracking-wider">
          TWITTER
        </div>
        <div className="text-lg font-semibold">Machine</div>
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
      <div className="mt-8 px-3 text-xs text-muted leading-relaxed">
        <span className="block font-mono uppercase tracking-wider mb-1">
          Mode
        </span>
        Manual — paste in, copy out. No X API connected.
      </div>
    </nav>
  );
}
