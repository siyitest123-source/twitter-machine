"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NoAccount } from "@/components/NoAccount";
import { useAccount } from "@/lib/account-context";

type Counts = { status: string; count: number }[];

export default function Dashboard() {
  const { currentId, current } = useAccount();
  const [counts, setCounts] = useState<Counts>([]);
  const [voiceCount, setVoiceCount] = useState(0);
  const [targetCount, setTargetCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentId === null) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/drafts?status=all&limit=1&accountId=${currentId}`).then((r) =>
        r.json(),
      ),
      fetch(`/api/voice?accountId=${currentId}`).then((r) => r.json()),
      fetch(`/api/targets?accountId=${currentId}`).then((r) => r.json()),
    ])
      .then(([d, v, t]) => {
        setCounts(d.counts ?? []);
        setVoiceCount(v.samples?.length ?? 0);
        setTargetCount(t.targets?.length ?? 0);
      })
      .finally(() => setLoading(false));
  }, [currentId]);

  const byStatus = (s: string) =>
    counts.find((c) => c.status === s)?.count ?? 0;

  if (currentId === null) return <NoAccount />;

  return (
    <div className="p-10 max-w-5xl">
      <h1 className="text-3xl font-semibold mb-1">Dashboard</h1>
      <p className="text-muted mb-8">
        Working on{" "}
        <span className="text-foreground font-medium">@{current?.handle}</span>.
        Paste tweets in. Get drafts out. Approve and copy to post.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <Stat label="Pending" value={byStatus("pending")} loading={loading} />
        <Stat label="Approved" value={byStatus("approved")} loading={loading} />
        <Stat
          label="Voice samples"
          value={voiceCount}
          loading={loading}
          subdued={voiceCount < 30}
          subduedHint={voiceCount < 30 ? "add 30+ for best results" : undefined}
        />
        <Stat
          label="Target accounts"
          value={targetCount}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ActionCard
          href="/generate"
          title="Generate drafts"
          body="Paste a tweet you want to engage with. Get 3 candidates in your voice."
        />
        <ActionCard
          href="/queue"
          title="Approval queue"
          body="Review pending drafts. Edit, approve, reject. Copy approved ones."
        />
        <ActionCard
          href="/voice"
          title="Train your voice"
          body="Paste your past tweets. The more samples, the better the output sounds like you."
        />
      </div>

      <div className="mt-12 p-5 bg-surface border border-border rounded-lg">
        <div className="text-xs font-mono uppercase tracking-wider text-muted mb-2">
          Workflow
        </div>
        <ol className="text-sm space-y-1.5 list-decimal list-inside">
          <li>Seed voice samples on the Voice page (30+ tweets recommended).</li>
          <li>Add accounts to engage with on the Targets page.</li>
          <li>
            See a tweet you want to reply to? Paste it on the Generate page.
          </li>
          <li>Review the candidates in the Queue. Edit + approve.</li>
          <li>Copy approved tweets and post manually on X.</li>
        </ol>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
  subdued,
  subduedHint,
}: {
  label: string;
  value: number;
  loading: boolean;
  subdued?: boolean;
  subduedHint?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div
        className={`text-3xl font-semibold mt-1 ${subdued ? "text-muted" : ""}`}
      >
        {loading ? "·" : value}
      </div>
      {subduedHint && (
        <div className="text-xs text-muted mt-1">{subduedHint}</div>
      )}
    </div>
  );
}

function ActionCard({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-surface border border-border rounded-lg p-5 hover:border-accent transition-colors"
    >
      <div className="font-medium mb-1">{title}</div>
      <div className="text-sm text-muted leading-relaxed">{body}</div>
    </Link>
  );
}
