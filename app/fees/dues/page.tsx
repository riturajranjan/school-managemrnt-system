"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Bell, Download, Phone, Users } from "lucide-react";
import Papa from "papaparse";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useReminderLog } from "@/lib/hooks/use-finance";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney } from "@/lib/finance/money";
import { agingBucketFor, agingBucketLabels, computeAgingBuckets, computeDuesMetrics, computeHighestOverdueClasses, computeStudentDuesRows, type AgingBucketKey, type StudentDuesRow } from "@/lib/selectors/dues-insights";
import { sendBulkReminders, sendManualReminder } from "@/lib/services/reminder-service";
import { downloadTextFile, formatDate } from "@/lib/utils";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };
const bucketOptions: (AgingBucketKey | "all")[] = ["all", "1-15", "16-30", "31-60", "61-90", "90-plus"];
const bucketTone: Record<AgingBucketKey, string> = { "not-overdue": "bg-success", "1-15": "bg-warning", "16-30": "bg-warning", "31-60": "bg-error/70", "61-90": "bg-error", "90-plus": "bg-error" };

export default function DuesPage() {
  const router = useRouter();
  const db = useSisStore();
  const classes = useManagedClasses();
  const reminderLog = useReminderLog();
  const { can } = usePermissions();
  const canAct = can("fees.viewDues") || can("fees.remind");

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [bucketFilter, setBucketFilter] = useState<AgingBucketKey | "all">("all");
  const [minAmount, setMinAmount] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const metrics = useMemo(() => computeDuesMetrics(db), [db]);
  const agingBuckets = useMemo(() => computeAgingBuckets(db.studentFeeItems), [db.studentFeeItems]);
  const highestClasses = useMemo(() => computeHighestOverdueClasses(db), [db]);
  const allRows = useMemo(() => computeStudentDuesRows(db), [db]);
  const totalAgingAmount = agingBuckets.reduce((sum, b) => sum + b.amount.minorUnits, 0) || 1;

  function studentInfo(studentId: string) {
    const s = db.students.find((st) => st.id === studentId);
    if (!s) return { name: studentId, classId: undefined, phone: undefined };
    const guardian = db.guardians.find((g) => g.id === s.primaryGuardianId);
    return { name: `${s.profile.firstName} ${s.profile.lastName}`, classId: s.classId, phone: guardian?.contact.phone };
  }
  function className(classId?: string) {
    return classes.find((c) => c.id === classId)?.name ?? "—";
  }
  function lastReminder(studentId: string) {
    return reminderLog.find((r) => r.studentId === studentId);
  }

  const filteredRows = allRows.filter((row) => {
    const info = studentInfo(row.studentId);
    if (search.trim() && !info.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (classFilter !== "all" && info.classId !== classFilter) return false;
    if (bucketFilter !== "all") {
      const items = db.studentFeeItems.filter((i) => i.studentId === row.studentId && i.status === "overdue");
      if (!items.some((i) => agingBucketFor(i) === bucketFilter)) return false;
    }
    if (minAmount && row.outstanding.minorUnits < Number(minAmount) * 100) return false;
    return true;
  });

  function exportCsv() {
    const csv = Papa.unparse(
      filteredRows.map((r) => ({
        Student: studentInfo(r.studentId).name,
        Class: className(studentInfo(r.studentId).classId),
        Outstanding: formatMoney(r.outstanding),
        Overdue: formatMoney(r.overdue),
        "Oldest overdue (days)": r.oldestOverdueDays,
      })),
    );
    downloadTextFile("dues-export.csv", csv);
  }

  const columns: ColumnDef<StudentDuesRow>[] = [
    {
      id: "student",
      header: "Student",
      alwaysVisible: true,
      sortValue: (r) => studentInfo(r.studentId).name,
      cell: (r) => {
        const info = studentInfo(r.studentId);
        return (
          <div>
            <p className="text-sm font-medium text-foreground">{info.name}</p>
            <p className="text-xs text-muted-foreground">{className(info.classId)}</p>
          </div>
        );
      },
    },
    { id: "outstanding", header: "Outstanding", align: "right", sortValue: (r) => r.outstanding.minorUnits, cell: (r) => <span className="text-sm text-foreground">{formatMoney(r.outstanding)}</span> },
    {
      id: "overdue",
      header: "Overdue",
      align: "right",
      sortValue: (r) => r.overdue.minorUnits,
      cell: (r) => <span className={`text-sm font-medium ${r.overdue.minorUnits > 0 ? "text-error" : "text-foreground"}`}>{formatMoney(r.overdue)}</span>,
    },
    { id: "age", header: "Oldest overdue", cell: (r) => <span className="text-sm text-muted-foreground">{r.oldestOverdueDays > 0 ? `${r.oldestOverdueDays} days` : "—"}</span> },
    {
      id: "reminder",
      header: "Last reminder",
      cell: (r) => {
        const last = lastReminder(r.studentId);
        return <span className="text-xs text-muted-foreground">{last ? formatDate(last.sentAt) : "Not sent"}</span>;
      },
      defaultVisible: false,
    },
    {
      id: "flags",
      header: "Flags",
      cell: (r) => (
        <div className="flex items-center gap-1">
          {r.hasTransport && <Badge tone="info">Transport</Badge>}
          {r.hasScholarship && <Badge tone="info">Scholarship</Badge>}
        </div>
      ),
      defaultVisible: false,
    },
  ];

  const rowActions: RowAction<StudentDuesRow>[] = canAct
    ? [
        { key: "reminder", label: "Send reminder", icon: <Bell className="size-3.5" />, onSelect: (r) => sendManualReminder(r.studentId, "in-app", ACTOR) },
        { key: "link", label: "Create payment link", onSelect: (r) => router.push(`/fees/payment-links?studentId=${r.studentId}`) },
        {
          key: "call",
          label: "Call parent",
          icon: <Phone className="size-3.5" />,
          hidden: (r) => !studentInfo(r.studentId).phone,
          onSelect: (r) => {
            const phone = studentInfo(r.studentId).phone;
            if (phone) window.location.href = `tel:${phone}`;
          },
        },
        { key: "profile", label: "View student", onSelect: (r) => router.push(`/students/${r.studentId}/fees`) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dues &amp; overdue</h1>
          <p className="text-xs text-muted-foreground">Aging, collection risk and follow-up actions</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-3.5" />
          Export
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total outstanding" value={formatMoney(metrics.totalOutstanding, { compact: true })} tone="neutral" />
        <StatTile label="Overdue" value={formatMoney(metrics.totalOverdue, { compact: true })} tone={metrics.totalOverdue.minorUnits > 0 ? "error" : "success"} />
        <StatTile label="Due this week" value={formatMoney(metrics.dueThisWeek, { compact: true })} tone="warning" />
        <StatTile label="Due this month" value={formatMoney(metrics.dueThisMonth, { compact: true })} tone="neutral" />
        <StatTile label="Students overdue" value={String(metrics.studentsOverdue)} icon={Users} tone={metrics.studentsOverdue > 0 ? "error" : "success"} />
        <StatTile label="Families, multiple overdue" value={String(metrics.familiesWithMultipleOverdue)} tone="warning" />
        <StatTile label="Collection risk (30+ days)" value={formatMoney(metrics.collectionRiskAmount, { compact: true })} tone="error" />
        <StatTile label="Average overdue age" value={`${metrics.averageOverdueAgeDays}d`} tone="neutral" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Aging</h2>
        <div className="flex h-3 w-full overflow-hidden rounded-pill bg-surface-secondary">
          {agingBuckets.map((b) => (
            <div key={b.bucket} title={`${agingBucketLabels[b.bucket]}: ${formatMoney(b.amount)}`} className={bucketTone[b.bucket]} style={{ width: `${(b.amount.minorUnits / totalAgingAmount) * 100}%` }} />
          ))}
        </div>
        <div className="mt-sm flex flex-wrap gap-sm text-xs">
          {agingBuckets.map((b) => (
            <button
              key={b.bucket}
              type="button"
              onClick={() => setBucketFilter(bucketFilter === b.bucket ? "all" : b.bucket)}
              className={`flex items-center gap-1.5 rounded-pill px-sm py-1 ${bucketFilter === b.bucket ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              <span className={`size-2 rounded-pill ${bucketTone[b.bucket]}`} />
              {agingBucketLabels[b.bucket]} · {b.count} · {formatMoney(b.amount, { compact: true })}
            </button>
          ))}
        </div>
      </div>

      {highestClasses.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Highest overdue classes</h2>
          <div className="flex flex-col gap-1">
            {highestClasses.map((c) => (
              <div key={c.classId} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{className(c.classId)}</span>
                <span className="flex items-center gap-sm text-xs text-muted-foreground">
                  {c.studentCount} student{c.studentCount === 1 ? "" : "s"}
                  <span className="font-medium text-error">{formatMoney(c.amount, { compact: true })}</span>
                </span>
              </div>
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
        <Select value={bucketFilter} onValueChange={(v) => setBucketFilter(v as AgingBucketKey | "all")}>
          <SelectTrigger className="w-40" aria-label="Overdue age">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bucketOptions.map((b) => (
              <SelectItem key={b} value={b}>
                {b === "all" ? "Any age" : agingBucketLabels[b]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="Min amount (₹)" type="number" className="w-36" />
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        getRowId={(r) => r.studentId}
        caption="Students with dues"
        rowActions={rowActions}
        selectable={canAct}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActionBar={
          <div className="flex items-center justify-between rounded-md bg-primary/10 px-sm py-2 text-sm">
            <span className="text-foreground">{selectedIds.size} selected</span>
            <Button
              size="sm"
              onClick={() => {
                sendBulkReminders([...selectedIds], "in-app", ACTOR);
                setSelectedIds(new Set());
              }}
            >
              <Bell className="size-3.5" />
              Send bulk reminder
            </Button>
          </div>
        }
        renderMobileCard={(r) => {
          const info = studentInfo(r.studentId);
          return (
            <Link
              href={`/students/${r.studentId}/fees`}
              className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{info.name}</p>
                <p className="text-xs text-muted-foreground">
                  {className(info.classId)} · {r.oldestOverdueDays > 0 ? `${r.oldestOverdueDays}d overdue` : "Not overdue"}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-error">{formatMoney(r.overdue, { compact: true })}</span>
            </Link>
          );
        }}
        emptyIcon={AlertTriangle}
        emptyTitle="No students with dues"
        emptyDescription="Everyone is fully paid up, or no filters match."
      />
    </div>
  );
}
