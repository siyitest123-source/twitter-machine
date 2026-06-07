"use client";

import { useEffect, useState } from "react";
import { NoAccount } from "@/components/NoAccount";
import { CreateForm } from "@/components/CreateForm";
import { useAccount } from "@/lib/account-context";
import type { VoiceSample } from "@/lib/schema";

export default function CreatePage() {
  const { currentId, current } = useAccount();

  if (currentId === null) return <NoAccount />;

  return (
    <div className="min-h-screen flex">
      {/* Chat canvas (center) */}
      <div className="flex-1 px-8 py-10 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-baseline gap-3 mb-1 text-[10px] font-mono uppercase tracking-wider text-muted">
            <span>Create · Chat mode</span>
            <span className="ml-auto">
              <kbd className="px-1 py-px border border-border rounded mx-0.5">⌘</kbd>
              <kbd className="px-1 py-px border border-border rounded mx-0.5">K</kbd>{" "}
              for quick mode
            </span>
          </div>
          <h1 className="text-2xl font-semibold mb-6">
            What are we making today?
          </h1>
          <CreateForm mode="chat" />
        </div>
      </div>

      {/* Voice rail (right) */}
      <aside className="w-[300px] shrink-0 border-l border-border bg-surface p-5 hidden lg:block">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-3">
          Voice
        </div>
        <div className="font-semibold text-base mb-1">
          @{current?.handle}
        </div>
        <div className="text-xs text-muted mb-4">
          {current?.displayName ?? "—"}
        </div>
        {current?.persona ? (
          <div className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-xs italic text-muted leading-relaxed mb-4">
            {current.persona}
          </div>
        ) : (
          <a
            href="/accounts"
            className="block border border-dashed border-border rounded-lg px-3 py-2.5 text-xs text-muted text-center hover:border-accent hover:text-accent transition-colors mb-4"
          >
            + Add a persona to sharpen the voice
          </a>
        )}
        <VoiceSamplesPreview accountId={currentId} handle={current?.handle ?? ""} />
      </aside>
    </div>
  );
}

function VoiceSamplesPreview({
  accountId,
  handle,
}: {
  accountId: number;
  handle: string;
}) {
  const [samples, setSamples] = useState<VoiceSample[]>([]);

  useEffect(() => {
    fetch(`/api/voice?accountId=${accountId}`)
      .then((r) => r.json())
      .then((d) => setSamples(d.samples ?? []));
  }, [accountId]);

  if (samples.length === 0) {
    return (
      <a
        href="/voice"
        className="block border border-dashed border-border rounded-lg px-3 py-3 text-xs text-muted text-center hover:border-accent hover:text-accent transition-colors"
      >
        + Train @{handle}&apos;s voice
      </a>
    );
  }

  return (
    <>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
        Recent samples ({samples.length})
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {samples.slice(0, 6).map((s) => (
          <div
            key={s.id}
            className="bg-surface-2 rounded-md px-3 py-2 text-xs text-foreground italic leading-relaxed line-clamp-3"
          >
            &ldquo;{s.text}&rdquo;
          </div>
        ))}
      </div>
      <a
        href="/voice"
        className="block mt-3 text-[10px] font-mono uppercase tracking-wider text-muted text-center py-2 border-t border-border hover:text-foreground"
      >
        Tune voice →
      </a>
    </>
  );
}
