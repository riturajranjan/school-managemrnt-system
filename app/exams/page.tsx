"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, FileBadge, Gauge, LayoutList, Plus, Search } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PulseGauge } from "@/components/dashboard/pulse-gauge";
import { toneClasses } from "@/components/dashboard/tone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExams } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { computeExamExceptionFeed, computeExamPulseFactors } from "@/lib/selectors/exams-insights";
import { examStatusLabels, examStatusTone, examTypeLabels, type Exam } from "@/lib/types/exams";
import { formatDate } from "@/lib/utils";

function StudentParentExamsView() {
  const exams = useExams();
  const classes = useManagedClasses();
  const upcoming = [...exams]
    .filter((e) => e.status === "scheduled" || e.status === "in-progress")
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  const published = exams.filter((e) => e.status === "published");
  const className = (classIds: string[]) => classIds.map((id) => classes.find((c) => c.id === id)?.name).filter(Boolean).join(", ") || "—";

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Exams</h1>
        <p className="text-xs text-muted-foreground">Your upcoming exams and published results</p>
      </div>

      <div className="flex flex-wrap gap-xs">
        <Button asChild size="sm" variant="outline">
          <Link href="/results/student">
            <FileBadge className="size-3.5" />
            View my results
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/report-cards">Report cards</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-foreground">Upcoming exams</p>
        {upcoming.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No upcoming exams scheduled.</p>}
        {upcoming.map((e) => (
          <div key={e.id} className="rounded-lg border border-border bg-surface p-sm">
            <p className="text-sm font-medium text-foreground">{e.name}</p>
            <p className="text-xs text-muted-foreground">
              {className(e.classIds)} · {formatDate(e.startDate)} – {formatDate(e.endDate)}
            </p>
          </div>
        ))}
      </div>

      {published.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-foreground">Published results</p>
          {published.map((e) => (
            <Link key={e.id} href="/results/student" className="flex items-center justify-between rounded-lg border border-border bg-surface p-sm text-sm outline-none hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring">
              <span className="text-foreground">{e.name}</span>
              <Badge tone="success">Published</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ExaminationCommandCentre() {
  const router = useRouter();
  const db = useSisStore();
  const exams = useExams();
  const classes = useManagedClasses();
  const { can } = usePermissions();
  const canCreate = can("exams.create");

  const [statusFilter, setStatusFilter] = useState<Exam["status"] | "all">("all");
  const [search, setSearch] = useState("");
  const [pulseOpen, setPulseOpen] = useState(false);

  const searched = search.trim() ? exams.filter((e) => `${e.name} ${e.code}`.toLowerCase().includes(search.trim().toLowerCase())) : exams;
  const filtered = useMemo(() => (statusFilter === "all" ? searched : searched.filter((e) => e.status === statusFilter)), [searched, statusFilter]);

  const active = exams.filter((e) => ["scheduled", "in-progress", "marks-entry", "verification", "result-processing"].includes(e.status)).length;
  const upcoming = exams.filter((e) => e.status === "scheduled" && new Date(e.startDate) > new Date()).length;
  const resultReady = exams.filter((e) => e.status === "result-ready").length;
  const published = exams.filter((e) => e.status === "published").length;

  const pulseFactors = useMemo(() => computeExamPulseFactors(db), [db]);
  const overallScore = Math.round(pulseFactors.reduce((sum, f) => sum + f.score, 0) / pulseFactors.length);
  const sortedByScore = [...pulseFactors].sort((a, b) => a.score - b.score);

  const exceptions = useMemo(() => computeExamExceptionFeed(db), [db]);

  const className = (classIds: string[]) => classIds.map((id) => classes.find((c) => c.id === id)?.name).filter(Boolean).join(", ") || "—";

  const columns: ColumnDef<Exam>[] = [
    {
      id: "name",
      header: "Exam",
      alwaysVisible: true,
      sortValue: (e) => e.name,
      cell: (e) => (
        <div>
          <p className="text-sm font-medium text-foreground">{e.name}</p>
          <p className="text-xs text-muted-foreground">{e.code} · {examTypeLabels[e.type]}</p>
        </div>
      ),
    },
    { id: "classes", header: "Classes", cell: (e) => <span className="text-sm text-foreground">{className(e.classIds)}</span> },
    { id: "dates", header: "Dates", cell: (e) => <span className="text-sm text-foreground">{formatDate(e.startDate)} – {formatDate(e.endDate)}</span> },
    { id: "term", header: "Term", cell: (e) => <span className="text-sm text-muted-foreground">{e.term}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (e) => <Badge tone={examStatusTone[e.status]}>{examStatusLabels[e.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Examination Command Centre</h1>
          <p className="text-xs text-muted-foreground">Every exam&apos;s schedule, marks, verification and result status in one place</p>
        </div>
        {canCreate && (
          <Button asChild size="sm">
            <Link href="/exams/new">
              <Plus className="size-3.5" />
              Create exam
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Active exams" value={String(active)} icon={ClipboardList} tone="info" />
        <StatTile label="Upcoming" value={String(upcoming)} icon={CalendarClock} tone="warning" />
        <StatTile label="Results ready" value={String(resultReady)} icon={FileBadge} tone="success" />
        <StatTile label="Published" value={String(published)} icon={CheckCircle2} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Exception feed</h2>
              <Badge tone={exceptions.length === 0 ? "success" : "warning"}>{exceptions.length} item(s)</Badge>
            </div>
            {exceptions.length === 0 ? (
              <p className="py-md text-center text-sm text-muted-foreground">No issues need attention right now.</p>
            ) : (
              <ul className="flex flex-col gap-sm">
                {exceptions.map((item) => {
                  const content = (
                    <>
                      <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${item.severity === "critical" ? "text-error" : "text-warning"}`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                    </>
                  );
                  return (
                    <li key={item.id}>
                      {item.href ? (
                        <Link href={item.href} className="flex items-start gap-sm rounded-md border border-border p-sm outline-none hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring">
                          {content}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-sm rounded-md border border-border p-sm">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-sm">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-sm top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exams by name or code" className="pl-9" />
            </div>
          </div>

          <div className="scrollbar-none flex items-center gap-1 overflow-x-auto rounded-md bg-surface-secondary p-1">
            {(["all", "draft", "scheduled", "in-progress", "marks-entry", "verification", "result-ready", "published", "archived"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`min-h-9 shrink-0 rounded-md px-sm text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}
              >
                {s === "all" ? "All" : examStatusLabels[s]}
              </button>
            ))}
          </div>

          <DataTable
            columns={columns}
            rows={filtered}
            getRowId={(e) => e.id}
            caption="Examinations"
            isFiltered={search.trim().length > 0 || statusFilter !== "all"}
            onRowClick={(e) => router.push(`/exams/${e.id}`)}
            renderMobileCard={(e) => (
              <Link
                href={`/exams/${e.id}`}
                className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{e.name}</p>
                  <Badge tone={examStatusTone[e.status]}>{examStatusLabels[e.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {e.code} · {className(e.classIds)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(e.startDate)} – {formatDate(e.endDate)}
                </p>
              </Link>
            )}
            emptyTitle="No exams match this filter"
          />
        </div>

        <div className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between">
              <h2 className="flex items-center gap-1 text-sm font-semibold text-foreground">
                <Gauge className="size-4" /> Exam Pulse
              </h2>
              <button type="button" onClick={() => setPulseOpen(true)} className="flex items-center gap-1 text-xs font-medium text-primary">
                <LayoutList className="size-3.5" />
                Breakdown
              </button>
            </div>
            <div className="flex flex-col items-center gap-sm">
              <PulseGauge score={overallScore} factors={pulseFactors} />
              <p className="text-center text-xs text-muted-foreground">
                Strongest: <span className="font-medium text-foreground">{sortedByScore[sortedByScore.length - 1].label}</span> · Main blocker:{" "}
                <span className="font-medium text-foreground">{sortedByScore[0].label}</span>
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Recommended action</h2>
            <p className="text-sm text-foreground">
              {sortedByScore[0].score >= 80
                ? "Everything's tracking well — no immediate action needed."
                : sortedByScore[0].key === "marksEntry"
                  ? "Chase down subjects still missing marks — see the exception feed above."
                  : sortedByScore[0].key === "verification"
                    ? "Review the marks-verification queue to keep results on schedule."
                    : sortedByScore[0].key === "schedule"
                      ? "Finish scheduling the remaining exam subjects."
                      : sortedByScore[0].key === "reportCards"
                        ? "Generate report cards for exams with calculated results."
                        : "Review the publication checklist for exams with results ready."}
            </p>
          </div>
        </div>
      </div>

      <DetailDrawer open={pulseOpen} onOpenChange={setPulseOpen} title="Exam Pulse breakdown" description="All factors contributing to the composite score">
        <div className="flex flex-col gap-md">
          {pulseFactors.map((factor) => (
            <div key={factor.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{factor.label}</span>
                <span className={toneClasses[factor.tone].text}>{factor.displayValue}</span>
              </div>
              <MiniBar percent={factor.score} toneClassName={toneClasses[factor.tone].dot} />
            </div>
          ))}
        </div>
      </DetailDrawer>
    </div>
  );
}

export default function ExamsPage() {
  const { role } = usePermissions();
  if (role === "student" || role === "parent") return <StudentParentExamsView />;
  return <ExaminationCommandCentre />;
}
