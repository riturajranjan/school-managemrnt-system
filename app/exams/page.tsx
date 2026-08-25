"use client";

// Exams (Phase 8A) — real PostgreSQL/API cutover. Same list shell (header,
// stat tiles, search, status filter, table) as before, now backed by
// /api/exams. The former "Exam Pulse" gauge and exception feed depended on
// Marks/Verification/Report-Card data that does not exist yet (Phase 8B/8C) and
// have been removed rather than fabricated; the student/parent view is likewise
// limited to real upcoming-exam data until Results (out of scope) are real.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarClock, ClipboardList, Layers, Plus, Search, Settings2 } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { createTermRequest, useExamTerms, useExams } from "@/lib/hooks/api/use-exams-api";
import type { ExamListItemDto, ExamStatus } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const examStatusLabels: Record<ExamStatus, string> = { draft: "Draft", scheduled: "Scheduled", completed: "Completed", archived: "Archived" };
const examStatusTone: Record<ExamStatus, "neutral" | "info" | "success" | "warning" | "error"> = { draft: "neutral", scheduled: "info", completed: "success", archived: "neutral" };

function StudentParentExamsView({ exams }: { exams: ExamListItemDto[] }) {
  const upcoming = [...exams].filter((e) => e.status === "scheduled").sort((a, b) => (a.startsOn < b.startsOn ? -1 : 1));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Exams</h1>
        <p className="text-xs text-muted-foreground">Your upcoming exams</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-foreground">Upcoming exams</p>
        {upcoming.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No upcoming exams scheduled.</p>}
        {upcoming.map((e) => (
          <div key={e.id} className="rounded-lg border border-border bg-surface p-sm">
            <p className="text-sm font-medium text-foreground">{e.name}</p>
            <p className="text-xs text-muted-foreground">{e.term.name} · {formatDate(e.startsOn)} – {formatDate(e.endsOn)}</p>
          </div>
        ))}
      </div>
      <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Results become available once the Marks module is enabled.</p>
    </div>
  );
}

function ExaminationList({ exams, loading, error }: { exams: ExamListItemDto[]; loading: boolean; error: string | null }) {
  const router = useRouter();
  const { can } = usePermissions();
  const canCreate = can("exams.create");

  const [statusFilter, setStatusFilter] = useState<ExamStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);

  const searched = search.trim() ? exams.filter((e) => `${e.name} ${e.code}`.toLowerCase().includes(search.trim().toLowerCase())) : exams;
  const filtered = useMemo(() => (statusFilter === "all" ? searched : searched.filter((e) => e.status === statusFilter)), [searched, statusFilter]);

  const scheduled = exams.filter((e) => e.status === "scheduled").length;
  const draft = exams.filter((e) => e.status === "draft").length;
  const completed = exams.filter((e) => e.status === "completed").length;

  const columns: ColumnDef<ExamListItemDto>[] = [
    {
      id: "name", header: "Exam", alwaysVisible: true, sortValue: (e) => e.name,
      cell: (e) => (
        <div>
          <p className="text-sm font-medium text-foreground">{e.name}</p>
          <p className="text-xs text-muted-foreground">{e.code} · {e.term.name}</p>
        </div>
      ),
    },
    { id: "classes", header: "Classes", cell: (e) => <span className="text-sm text-foreground">{e.classCount || "—"}</span> },
    { id: "schedule", header: "Papers scheduled", cell: (e) => <span className="text-sm text-foreground">{e.scheduleCount}</span> },
    { id: "dates", header: "Dates", cell: (e) => <span className="text-sm text-foreground">{formatDate(e.startsOn)} – {formatDate(e.endsOn)}</span> },
    { id: "status", header: "Status", align: "right", cell: (e) => <Badge tone={examStatusTone[e.status]}>{examStatusLabels[e.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Exams</h1>
          <p className="text-xs text-muted-foreground">Exam terms, schedules and class applicability</p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap items-center gap-xs">
            <Button size="sm" variant="outline" onClick={() => setTermsOpen(true)}>
              <Settings2 className="size-3.5" />
              Terms
            </Button>
            <Button asChild size="sm">
              <Link href="/exams/new">
                <Plus className="size-3.5" />
                Create exam
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Draft" value={String(draft)} icon={ClipboardList} tone="neutral" />
        <StatTile label="Scheduled" value={String(scheduled)} icon={CalendarClock} tone="info" />
        <StatTile label="Completed" value={String(completed)} icon={Layers} tone="success" />
        <StatTile label="Total" value={String(exams.length)} icon={ClipboardList} tone="neutral" />
      </div>

      {error && !loading && <p className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load exams: {error}</p>}

      <div className="flex items-center gap-sm">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-sm top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exams by name or code" className="pl-9" />
        </div>
      </div>

      <div className="scrollbar-none flex items-center gap-1 overflow-x-auto rounded-md bg-surface-secondary p-1">
        {(["all", "draft", "scheduled", "completed", "archived"] as const).map((s) => (
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

      {loading ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading exams…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(e) => e.id}
          caption="Examinations"
          isFiltered={search.trim().length > 0 || statusFilter !== "all"}
          onRowClick={(e) => router.push(`/exams/${e.id}`)}
          renderMobileCard={(e) => (
            <Link href={`/exams/${e.id}`} className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{e.name}</p>
                <Badge tone={examStatusTone[e.status]}>{examStatusLabels[e.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{e.code} · {e.term.name}</p>
              <p className="text-xs text-muted-foreground">{formatDate(e.startsOn)} – {formatDate(e.endsOn)}</p>
            </Link>
          )}
          emptyTitle="No exams match this filter"
        />
      )}

      <TermsDrawer open={termsOpen} onOpenChange={setTermsOpen} />
    </div>
  );
}

function TermsDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: terms, loading, reload } = useExamTerms();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim() || !code.trim()) { setError("Enter a name and code."); return; }
    setBusy(true); setError(null);
    const res = await createTermRequest({ name: name.trim(), code: code.trim() });
    setBusy(false);
    if (!res.success) { setError(res.error.message); return; }
    setName(""); setCode(""); reload();
  }

  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="Exam terms" description="Terms group exams within the academic session">
      <div className="flex flex-col gap-sm">
        {error && <p className="text-xs text-error">{error}</p>}
        <div className="flex flex-col gap-sm rounded-lg border border-border p-sm">
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="term-name">Name</Label>
              <Input id="term-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Term 1" />
            </div>
            <div>
              <Label htmlFor="term-code">Code</Label>
              <Input id="term-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. T1" />
            </div>
          </div>
          <Button size="sm" disabled={busy} onClick={() => void add()}>Add term</Button>
        </div>
        {loading ? (
          <p className="py-lg text-center text-sm text-muted-foreground">Loading…</p>
        ) : (terms ?? []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No terms yet.</p>
        ) : (
          <ul className="flex flex-col gap-xs">
            {terms.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-sm text-sm">
                <span className="text-foreground">{t.name} <span className="text-xs text-muted-foreground">({t.code})</span></span>
                <span className="text-xs text-muted-foreground">{t.examCount} exam{t.examCount === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DetailDrawer>
  );
}

export default function ExamsPage() {
  const { role, hasServerPermission, capabilitiesLoading } = usePermissions();
  const { data: exams, loading, error } = useExams();
  // Student/Guardian self-view is identity-based (Student.userId / Guardian.userId),
  // not permission-based — STUDENT/GUARDIAN hold no exams.* permissions at all, so
  // the view gate below applies only to the staff (ExaminationList) branch.
  if (role === "student" || role === "parent") return <StudentParentExamsView exams={exams} />;
  if (!capabilitiesLoading && !hasServerPermission("exams.view")) {
    return <PermissionDenied action="view exams" role={roleLabels[role]} backHref="/" />;
  }
  return <ExaminationList exams={exams} loading={loading} error={error} />;
}
