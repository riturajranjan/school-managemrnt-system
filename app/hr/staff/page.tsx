"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Eye, Plus, Search, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { EmployeeAvatar } from "@/components/hr/employee-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { employeeStatusLabels, employeeStatusTone, employmentTypeLabels, type Employee, type EmployeeStatus } from "@/lib/types/hr";
import { downloadTextFile, formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/finance/money";

export default function StaffDirectoryPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [preview, setPreview] = useState<Employee | null>(null);

  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? "—";
  const desigTitle = (id: string) => db.designations.find((d) => d.id === id)?.title ?? "—";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.employees
      .filter((e) => (dept === "all" ? true : e.departmentId === dept))
      .filter((e) => (status === "all" ? true : e.status === status))
      .filter((e) => (q ? `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) : true));
  }, [db.employees, query, dept, status]);

  if (!can("hr.view")) return <PermissionDenied action="view the staff directory" role={roleLabels[role]} backHref="/hr/employee-self-service" />;
  const canSensitive = can("hr.viewSensitive");
  const isFiltered = query.trim() !== "" || dept !== "all" || status !== "all";

  function exportCsv() {
    const header = "Employee ID,Name,Designation,Department,Type,Joined,Status";
    const lines = rows.map((e) => [e.employeeCode, `${e.firstName} ${e.lastName}`, desigTitle(e.designationId), deptName(e.departmentId), employmentTypeLabels[e.employmentType], e.joiningDate, employeeStatusLabels[e.status]].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    downloadTextFile("staff-directory.csv", [header, ...lines].join("\n"));
  }

  const columns: ColumnDef<Employee>[] = [
    {
      id: "name",
      header: "Employee",
      alwaysVisible: true,
      sortValue: (e) => `${e.firstName} ${e.lastName}`,
      cell: (e) => (
        <Link href={`/hr/staff/${e.id}`} className="flex min-w-0 items-center gap-sm">
          <EmployeeAvatar firstName={e.firstName} lastName={e.lastName} color={e.photoColor} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground underline-offset-2 hover:underline">{e.firstName} {e.lastName}</span>
            <span className="block truncate text-xs text-muted-foreground">{e.employeeCode} · {desigTitle(e.designationId)}</span>
          </span>
        </Link>
      ),
    },
    { id: "dept", header: "Department", cell: (e) => <span className="text-sm text-muted-foreground">{deptName(e.departmentId)}</span> },
    { id: "type", header: "Type", cell: (e) => <Badge tone="neutral">{employmentTypeLabels[e.employmentType]}</Badge>, defaultVisible: false },
    { id: "joined", header: "Joined", sortValue: (e) => e.joiningDate, cell: (e) => <span className="text-xs text-muted-foreground">{formatDate(e.joiningDate)}</span>, defaultVisible: false },
    { id: "attendance", header: "Attendance", align: "right", sortValue: (e) => e.attendancePercent, cell: (e) => <span className={`text-sm font-medium ${e.attendancePercent >= 90 ? "text-success" : e.attendancePercent >= 80 ? "text-warning" : "text-error"}`}>{e.attendancePercent}%</span> },
    { id: "status", header: "Status", align: "right", cell: (e) => <Badge tone={employeeStatusTone[e.status]}>{employeeStatusLabels[e.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Staff directory</h1>
          <p className="text-xs text-muted-foreground">{db.employees.length} employees across {db.departments.length} departments</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-3.5" /> Export
          </Button>
          {can("hr.manageStaff") && (
            <Button asChild size="sm">
              <Link href="/hr/staff/new">
                <Plus className="size-3.5" /> Add employee
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ID or email…" className="pl-8" aria-label="Search staff" />
        </div>
        <div className="flex gap-xs">
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="w-40" aria-label="Filter by department"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {db.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" aria-label="Filter by status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(employeeStatusLabels) as EmployeeStatus[]).map((s) => <SelectItem key={s} value={s}>{employeeStatusLabels[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(e) => e.id}
        caption="Staff directory"
        isFiltered={isFiltered}
        emptyIcon={Users}
        emptyTitle="No staff found"
        rowActions={[{ key: "preview", label: "Quick preview", icon: <Eye className="size-4" />, onSelect: (e) => setPreview(e) }]}
        renderMobileCard={(e) => (
          <Link href={`/hr/staff/${e.id}`} className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-sm">
            <EmployeeAvatar firstName={e.firstName} lastName={e.lastName} color={e.photoColor} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{e.firstName} {e.lastName}</p>
                <Badge tone={employeeStatusTone[e.status]}>{employeeStatusLabels[e.status]}</Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">{desigTitle(e.designationId)} · {deptName(e.departmentId)}</p>
              <p className="text-xs text-muted-foreground">{e.employeeCode} · {e.attendancePercent}% attendance</p>
            </div>
          </Link>
        )}
      />

      <DetailDrawer open={preview !== null} onOpenChange={(o) => !o && setPreview(null)} title="Employee preview" description="Quick employee summary">
        {preview && (
          <div className="flex flex-col gap-md">
            <div className="flex items-center gap-sm">
              <EmployeeAvatar firstName={preview.firstName} lastName={preview.lastName} color={preview.photoColor} size="lg" />
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">{preview.firstName} {preview.lastName}</p>
                <p className="text-xs text-muted-foreground">{desigTitle(preview.designationId)} · {deptName(preview.departmentId)}</p>
                <Badge tone={employeeStatusTone[preview.status]} className="mt-1">{employeeStatusLabels[preview.status]}</Badge>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-sm text-sm">
              <Field label="Employee ID" value={preview.employeeCode} />
              <Field label="Type" value={employmentTypeLabels[preview.employmentType]} />
              <Field label="Joined" value={formatDate(preview.joiningDate)} />
              <Field label="Attendance" value={`${preview.attendancePercent}%`} />
              <Field label="Leave balance" value={`${preview.leaveBalanceDays} days`} />
              {canSensitive && <Field label="Gross salary" value={formatMoney(preview.grossSalary)} />}
              <Field label="Email" value={preview.email} />
              <Field label="Phone" value={preview.phone} />
            </dl>
            <Button asChild size="sm">
              <Link href={`/hr/staff/${preview.id}`}>Open full profile</Link>
            </Button>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground">{value}</dd>
    </div>
  );
}
