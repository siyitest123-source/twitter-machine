"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CreateForm } from "@/components/CreateForm";
import { useAccount } from "@/lib/account-context";

/**
 * Global ⌘K palette wrapping CreateForm in compact mode. Mounted in the
 * root layout so it can pop from any page. Listens for Cmd/Ctrl+K.
 */
export function CreatePalette() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { currentId, current } = useAccount();

  const close = useCallback(() => setOpen(false), []);

  // Don't bind shortcut on the /create page itself — the page already IS the form.
  const onCreatePage = pathname?.startsWith("/create") ?? false;

  useEffect(() => {
    if (onCreatePage) return;
    function onKey(e: KeyboardEvent) {
      // Cmd/Ctrl+K toggles
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // ESC closes when open
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCreatePage]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-black/55 backdrop-blur-[2px]"
      onClick={close}
    >
      <div
        className="w-full max-w-[740px] max-h-[80vh] overflow-y-auto bg-surface-2 border border-border rounded-2xl shadow-[0_0_0_1px_rgba(91,141,246,.4),0_24px_60px_rgba(0,0,0,.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-muted">/</span>
            <span className="font-semibold">Create</span>
            <span className="text-xs text-muted">
              for{" "}
              <span className="text-foreground">
                @{current?.handle ?? "—"}
              </span>
            </span>
          </div>
          <button
            onClick={close}
            className="text-[10px] font-mono px-2 py-1 border border-border rounded bg-background text-muted hover:text-foreground"
          >
            ESC
          </button>
        </div>

        {currentId === null ? (
          <div className="px-5 py-8 text-center text-sm text-muted">
            No account selected.{" "}
            <a href="/accounts" className="text-accent underline">
              Create one →
            </a>
          </div>
        ) : (
          <CreateForm mode="compact" onClose={close} />
        )}
      </div>
    </div>
  );
}
