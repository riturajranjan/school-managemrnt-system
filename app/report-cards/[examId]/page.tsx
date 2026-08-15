"use client";

// Report card roster (Phase 8D) — real PostgreSQL/API cutover. Lists every
// student with a published result for this exam; open a student to view/print
// their official report card. Search is server-side (name/admission number).
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { GraduationCap, Search, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useReportCardRoster } from "@/lib/hooks/api/use-report-cards-api";
import type { ReportCardRosterEntryDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusTone: Record<string, "success" | "error" | "warning" | "neutral"> = { pass: "success", fail: "error", absent: "neutral", incomplete: "warning" };

export default function ReportCardRosterPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const { data, loading, error } = useReportCardRoster(params.examId, search || undefined);

  if (!can("results.view")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to view report cards.</p>;
  }
  if (loading && !data) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (error) {
    return (
      <div className="flex flex-col gap-sm">
        <Link href="/report-cards" className="text-xs text-muted-foreground hover:underline">← Report cards</Link>
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  const passCount = data.students.filter((s) => s.status === "pass").length;

  const columns: ColumnDef<ReportCardRosterEntryDto>[] = [
    { id: "student", header: "Student", alwaysVisible: true, sortValue: (r) => r.name, cell: (r) => (
      <div><p className="text-sm font-medium text-foreground">{r.name}</p><p className="text-xs text-muted-foreground">Roll {r.rollNumber ?? "—"} · {r.admissionNumber}</p></div>
    ) },
    { id: "class", header: "Class", cell: (r) => <span className="text-xs text-muted-foreground">{r.className ? `${r.className}${r.sectionName ? `-${r.sectionName}` : ""}` : "—"}</span> },
    { id: "marks", header: "Marks", cell: (r) => <span className="text-xs text-muted-foreground">{r.totalMarksObtained}/{r.totalMaxMarks}{r.percentage !== null ? ` · ${r.percentage}%` : ""}</span> },
    { id: "grade", header: "Grade", cell: (r) => (r.grade ? <Badge tone="info">{r.grade}</Badge> : <span className="text-xs text-muted-foreground">—</span>) },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={statusTone[r.status]}>{r.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm">
        <Link href="/report-cards" className="text-xs text-muted-foreground hover:underline">← Report cards</Link>
        <h1 className="text-lg font-semibold text-foreground">{data.exam.examName}</h1>
        <p className="text-xs text-muted-foreground">{data.exam.examCode} · {data.exam.termName} · {formatDate(data.exam.startsOn)} – {formatDate(data.exam.endsOn)}</p>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        <StatTile label="Students" value={String(data.exam.studentCount)} icon={Users} tone="neutral" />
        <StatTile label="Pass" value={String(passCount)} icon={GraduationCap} tone="success" />
        <StatTile label="Fail / Absent" value={String(data.exam.studentCount - passCount)} tone={data.exam.studentCount - passCount > 0 ? "warning" : "neutral"} />
      </div>

      <div className="flex items-center gap-sm rounded-md border border-input bg-surface px-sm">
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or admission number" className="border-0 px-0 focus-visible:ring-0" />
      </div>

      <DataTable
        columns={columns}
        rows={data.students}
        getRowId={(r) => r.studentId}
        caption="Report card roster"
        onRowClick={(r) => router.push(`/report-cards/${params.examId}/${r.studentId}`)}
        renderMobileCard={(r) => (
          <Link
            href={`/report-cards/${params.examId}/${r.studentId}`}
            className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground">Roll {r.rollNumber ?? "—"} · {r.className ? `${r.className}${r.sectionName ? `-${r.sectionName}` : ""}` : "—"}</p>
            </div>
            <Badge tone={statusTone[r.status]}>{r.status}</Badge>
          </Link>
        )}
        emptyTitle="No matching students"
        emptyDescription="Try a different search term."
      />
    </div>
  );
}
