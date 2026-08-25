"use client";

// Real PostgreSQL/API cutover (Phase 9F) — reads GET /api/fees/dues(+/summary),
// both derived from the same canonical chargeBalance formula the Collection
// and Reports pages use. "Send reminder" links to the honest reminder-
// candidate preview (no real Student/Guardian delivery channel exists yet —
// see lib/server/fees/reminders.ts) rather than simulating a send.
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Bell, Download, Users } from "lucide-react";
import Papa from "papaparse";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useClasses } from "@/lib/hooks/api/use-academics-foundation";
import { useDuesSummary, useStudentDues } from "@/lib/hooks/api/use-fees-api";
import type { StudentDuesRowDto, DuesAgingBucketDto } from "@/lib/api/contracts";
import { roleLabels } from "@/lib/permissions/roles";
import { downloadTextFile, formatCurrency } from "@/lib/utils";

const bucketLabels: Record<DuesAgingBucketDto["bucket"], string> = { current: "Current", "1-15": "1–15 days", "16-30": "16–30 days", "31-60": "31–60 days", "61-90": "61–90 days", "90-plus": "90+ days" };
const bucketTone: Record<DuesAgingBucketDto["bucket"], string> = { current: "bg-success", "1-15": "bg-warning", "16-30": "bg-warning", "31-60": "bg-error/70", "61-90": "bg-error", "90-plus": "bg-error" };

export default function DuesPage() {
  const { data: classes } = useClasses();
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canAct = can("fees.view") || can("fees.manage");

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const { data: summary } = useDuesSummary();
  const { data: rows, loading, error } = useStudentDues({ search: search.trim() || undefined, classId: classFilter === "all" ? undefined : classFilter });

  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;

  const allRows = rows ?? [];
  const totalAgingAmount = summary?.aging.reduce((sum, b) => sum + b.amount, 0) || 1;

  function exportCsv() {
    const csv = Papa.unparse(
      allRows.map((r) => ({ Student: r.studentName, Class: r.className ?? "", Outstanding: formatCurrency(r.outstanding), Overdue: formatCurrency(r.overdue), "Oldest overdue (days)": r.oldestOverdueDays })),
    );
    downloadTextFile("dues-export.csv", csv);
  }

  const columns: ColumnDef<StudentDuesRowDto>[] = [
    {
      id: "student",
      header: "Student",
      alwaysVisible: true,
      sortValue: (r) => r.studentName,
      cell: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{r.studentName}</p>
          <p className="text-xs text-muted-foreground">{r.className ?? "—"}</p>
        </div>
      ),
    },
    { id: "outstanding", header: "Outstanding", align: "right", sortValue: (r) => r.outstanding, cell: (r) => <span className="text-sm text-foreground">{formatCurrency(r.outstanding)}</span> },
    { id: "overdue", header: "Overdue", align: "right", sortValue: (r) => r.overdue, cell: (r) => <span className={`text-sm font-medium ${r.overdue > 0 ? "text-error" : "text-foreground"}`}>{formatCurrency(r.overdue)}</span> },
    { id: "age", header: "Oldest overdue", cell: (r) => <span className="text-sm text-muted-foreground">{r.oldestOverdueDays > 0 ? `${r.oldestOverdueDays} days` : "—"}</span> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dues &amp; overdue</h1>
          <p className="text-xs text-muted-foreground">Real-time outstanding balances derived from every charge, adjustment and payment</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-3.5" />
          Export
        </Button>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

      {summary && (
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
          <StatTile label="Total outstanding" value={formatCurrency(summary.totalOutstanding)} tone="neutral" />
          <StatTile label="Overdue" value={formatCurrency(summary.totalOverdue)} tone={summary.totalOverdue > 0 ? "error" : "success"} />
          <StatTile label="Due this week" value={formatCurrency(summary.dueThisWeek)} tone="warning" />
          <StatTile label="Due this month" value={formatCurrency(summary.dueThisMonth)} tone="neutral" />
          <StatTile label="Students overdue" value={String(summary.studentsOverdue)} icon={Users} tone={summary.studentsOverdue > 0 ? "error" : "success"} />
        </div>
      )}

      {summary && summary.aging.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Aging</h2>
          <div className="flex h-3 w-full overflow-hidden rounded-pill bg-surface-secondary">
            {summary.aging.map((b) => (
              <div key={b.bucket} title={`${bucketLabels[b.bucket]}: ${formatCurrency(b.amount)}`} className={bucketTone[b.bucket]} style={{ width: `${(b.amount / totalAgingAmount) * 100}%` }} />
            ))}
          </div>
          <div className="mt-sm flex flex-wrap gap-sm text-xs">
            {summary.aging.map((b) => (
              <span key={b.bucket} className="flex items-center gap-1.5 rounded-pill px-sm py-1 text-muted-foreground">
                <span className={`size-2 rounded-pill ${bucketTone[b.bucket]}`} />
                {bucketLabels[b.bucket]} · {b.count} · {formatCurrency(b.amount)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-xs">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student" className="w-48" />
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-40" aria-label="Class">
            <SelectValue placeholder="All classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canAct && (
          <Button size="sm" variant="outline" asChild>
            <Link href="/fees/reminders">
              <Bell className="size-3.5" />
              Reminders
            </Link>
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={allRows}
        getRowId={(r) => r.studentId}
        caption="Students with dues"
        renderMobileCard={(r) => (
          <Link href={`/students/${r.studentId}/fees`} className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{r.studentName}</p>
              <p className="text-xs text-muted-foreground">
                {r.className ?? "—"} · {r.oldestOverdueDays > 0 ? `${r.oldestOverdueDays}d overdue` : "Not overdue"}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium text-error">{formatCurrency(r.overdue)}</span>
          </Link>
        )}
        emptyIcon={AlertTriangle}
        emptyTitle={loading ? "Loading…" : "No students with dues"}
        emptyDescription="Everyone is fully paid up, or no filters match."
      />
    </div>
  );
}
