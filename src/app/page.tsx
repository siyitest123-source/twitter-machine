"use client";

import Link from "next/link";
import { type ReactElement, useEffect, useState } from "react";
import { NoAccount } from "@/components/NoAccount";
import { useAccount } from "@/lib/account-context";
import {
  IconArrow,
  IconArrowUpRight,
  IconCalendar,
  IconChart,
  IconCreate,
  IconQueue,
  IconTarget,
  IconVoice,
} from "@/components/Icons";

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
      fetch(`/api/drafts?status=all&limit=1&accountId=${currentId}`).then((r) => r.json()),
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

  if (currentId === null) return <NoAccount />;

  const byStatus = (s: string) =>
    counts.find((c) => c.status === s)?.count ?? 0;

  return (
    <div className="page page-mid rise">
      {/* Page head */}
      <div className="page-head">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 20,
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 className="page-title">
              Good morning, @{current?.handle}
            </h1>
            <p className="page-sub">
              Paste tweets in, get drafts in your voice, approve and ship.
              Here&apos;s where things stand.
            </p>
          </div>
          <Link href="/create" className="btn btn-primary">
            <IconCreate size={17} />
            Create
          </Link>
        </div>
      </div>

      {/* Stat row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--gap-card)",
          marginBottom: 14,
        }}
      >
        <Stat
          label="In queue"
          value={byStatus("pending")}
          Icon={IconQueue}
          hint={loading ? "…" : `${byStatus("pending")} awaiting review`}
        />
        <Stat
          label="Approved"
          value={byStatus("approved")}
          Icon={IconCalendar}
          hint="ready to schedule"
          accent
        />
        <Stat
          label="Voice samples"
          value={voiceCount}
          Icon={IconVoice}
          hint={
            voiceCount < 30
              ? `add ${30 - voiceCount} for sharper output`
              : "well trained"
          }
          hintWarn={voiceCount < 30}
        />
        <Stat
          label="Targets"
          value={targetCount}
          Icon={IconTarget}
          hint="accounts watched"
        />
      </div>

      {/* Two-up: quick actions + workflow */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "var(--gap-card)",
          alignItems: "start",
          marginTop: 26,
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Jump back in
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--gap-card)",
            }}
          >
            <QuickAction
              href="/create"
              Icon={IconCreate}
              title="Generate drafts"
              body="Paste a tweet or a brief. Get candidates written in your voice."
            />
            <QuickAction
              href="/queue"
              Icon={IconQueue}
              title="Review queue"
              body={`${byStatus("pending")} pending drafts ready to approve, edit, or reject.`}
            />
            <QuickAction
              href="/calendar"
              Icon={IconCalendar}
              title="Plan the week"
              body="Drag approved drafts across the calendar to schedule them."
            />
            <QuickAction
              href="/voice"
              Icon={IconVoice}
              title="Train voice"
              body="Paste past tweets so new drafts sound unmistakably like you."
            />
          </div>
        </div>

        {/* Workflow card */}
        <div className="card" style={{ padding: 22 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div className="eyebrow">Workflow</div>
            <Link href="/voice" className="btn btn-ghost btn-sm">
              Voice
              <IconArrow size={15} />
            </Link>
          </div>
          <ol
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {[
              "Seed voice samples (30+ tweets).",
              "Add target accounts you want to engage with.",
              "See a tweet to reply to? Paste it on Create.",
              "Review candidates in Queue. Edit + approve.",
              "Drag approved drafts onto Calendar, then post manually.",
            ].map((step, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: "var(--ink-2)",
                }}
              >
                <span
                  style={{
                    flex: "none",
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/* ---------- primitives ---------- */

function Stat({
  label,
  value,
  Icon,
  hint,
  hintWarn,
  accent,
}: {
  label: string;
  value: number;
  Icon: (p: { size?: number; className?: string }) => ReactElement;
  hint?: string;
  hintWarn?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="card stat rise">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <Icon size={17} className="stat-ic" />
      </div>
      <div>
        <div
          className="stat-val tnum"
          style={accent ? { color: "var(--accent-ink)" } : undefined}
        >
          {value}
        </div>
        {hint && (
          <div
            className={`stat-hint${hintWarn ? " warn" : ""}`}
            style={{ marginTop: 6 }}
          >
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  Icon,
  title,
  body,
}: {
  href: string;
  Icon: (p: { size?: number }) => ReactElement;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="card qa">
      <IconArrowUpRight size={16} className="qa-arrow" />
      <div className="qa-ic">
        <Icon size={20} />
      </div>
      <div className="qa-title">{title}</div>
      <div className="qa-body">{body}</div>
    </Link>
  );
}
