"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { activeReaders, digitalUsage, mostIssuedBooks, mostReservedBooks, subjectInterest, titlesNeedingCopies, underusedBooks } from "@/lib/selectors/library-reports";
import { librarySummary } from "@/lib/selectors/library-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { downloadTextFile } from "@/lib/utils";

export default function LibraryReportsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();

  if (!can("library.viewReports")) return <PermissionDenied action="view library reports" role={roleLabels[role]} />;

  const summary = librarySummary(db);
  const issued = mostIssuedBooks(db, 6);
  const reserved = mostReservedBooks(db, 6);
  const subjects = subjectInterest(db);
  const maxSubject = Math.max(1, ...subjects.map((s) => s.count));
  const digital = digitalUsage(db, 6);
  const maxViews = Math.max(1, ...digital.map((d) => d.views));
  const readers = activeReaders(db, 6);
  const needCopies = titlesNeedingCopies(db, 6);
  const underused = underusedBooks(db, 6);

  function exportSummary() {
    const lines = [
      "Metric,Value",
      `Total titles,${summary.totalTitles}`,
      `Total copies,${summary.totalCopies}`,
      `Available,${summary.availableCopies}`,
      `Issued,${summary.issuedCopies}`,
      `Overdue,${summary.overdueLoans}`,
      `Active members,${summary.activeMembers}`,
      `Digital resources,${summary.digitalResources}`,
    ];
    downloadTextFile("library-report.csv", lines.join("\n"));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Reports & reading analytics</h1>
          <p className="text-xs text-muted-foreground">Positive engagement insights — not competitive rankings</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportSummary}>
          <Download className="size-3.5" /> Export summary
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <Panel title="Most issued titles">
          <RankedTitles rows={issued.map((r) => ({ id: r.book.id, label: r.book.title, value: `${r.count}×` }))} />
        </Panel>
        <Panel title="Most reserved titles">
          <RankedTitles rows={reserved.map((r) => ({ id: r.book.id, label: r.book.title, value: `${r.count}×` }))} />
        </Panel>

        <Panel title="Subject interest">
          {subjects.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-sm">
              {subjects.map((s) => (
                <div key={s.subject} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{s.subject}</span>
                    <span className="text-muted-foreground">{s.count}</span>
                  </div>
                  <MiniBar percent={(s.count / maxSubject) * 100} toneClassName="bg-primary" />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Digital resource usage">
          {digital.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-sm">
              {digital.map((d) => (
                <div key={d.resource.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate text-foreground">{d.resource.title}</span>
                    <span className="text-muted-foreground">{d.views}</span>
                  </div>
                  <MiniBar percent={(d.views / maxViews) * 100} toneClassName="bg-info" />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Active readers">
          {readers.length === 0 ? (
            <Empty />
          ) : (
            <ul className="flex flex-col gap-xs">
              {readers.map((r) => (
                <li key={r.member.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-foreground">{r.member.name}</span>
                  <Badge tone="success">{r.count} read</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Titles worth promoting">
          <p className="mb-xs text-xs text-muted-foreground">Underused titles — never issued yet.</p>
          {underused.length === 0 ? (
            <Empty />
          ) : (
            <ul className="flex flex-col gap-xs">
              {underused.map((b) => (
                <li key={b.id}>
                  <Link href={`/library/books/${b.id}`} className="truncate text-sm text-foreground hover:underline">
                    {b.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {needCopies.length > 0 && (
        <Panel title="Buy more copies">
          <RankedTitles rows={needCopies.map((r) => ({ id: r.book.id, label: r.book.title, value: `${r.queue} waiting` }))} tone="warning" />
        </Panel>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-md">
      <h2 className="mb-sm text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function RankedTitles({ rows, tone = "info" }: { rows: { id: string; label: string; value: string }[]; tone?: "info" | "warning" }) {
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="flex flex-col gap-xs">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-sm">
          <Link href={`/library/books/${r.id}`} className="truncate text-sm text-foreground hover:underline">
            {r.label}
          </Link>
          <Badge tone={tone}>{r.value}</Badge>
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <p className="text-xs text-muted-foreground">Not enough data yet.</p>;
}
