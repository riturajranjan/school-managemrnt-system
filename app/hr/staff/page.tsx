"use client";

// Staff directory (Phase 9J; department/designation filters now backed by the
// real Phase 9P masters) — real PostgreSQL/API cutover. GET /api/staff. hr.view.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { useDepartments } from "@/lib/hooks/api/use-hr-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { EmploymentType, StaffListItemDto, StaffStatus } from "@/lib/api/contracts";
import { downloadTextFile } from "@/lib/utils";

const statusLabels: Record<StaffStatus, string> = { active: "Active", inactive: "Inactive", archived: "Archived" };
const statusTone: Record<StaffStatus, "success" | "warning" | "neutral"> = { active: "success", inactive: "warning", archived: "neutral" };
const employmentTypeLabels: Record<EmploymentType, string> = { "full-time": "Full-time", "part-time": "Part-time", contract: "Contract", temporary: "Temporary" };

export default function StaffDirectoryPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const departmentIdFromUrl = useSearchParams().get("departmentId") ?? "all";
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState(departmentIdFromUrl);
  const [status, setStatus] = useState("all");
  const [preview, setPreview] = useState<StaffListItemDto | null>(null);

  const { data: staff, loading, error } = useStaffList({ pageSize: 200 });
  const { data: departments } = useDepartments();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff
      .filter((e) => (dept === "all" ? true : e.departmentId === dept))
      .filter((e) => (status === "all" ? true : e.status === status))
      .filter((e) => (q ? e.name.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q) || (e.email ?? "").toLowerCase().includes(q) : true));
  }, [staff, query, dept, status]);

  if (!capabilitiesLoading && !hasServerPermission("hr.view")) {
    return <PermissionDenied action="view the staff directory" role={roleLabels[role]} backHref="/hr/employee-self-service" />;
  }
  const canManage = hasServerPermission("hr.manage");
  const canPayroll = hasServerPermission("payroll.view");
  const isFiltered = query.trim() !== "" || dept !== "all" || status !== "all";

  function exportCsv() {
    const header = "Employee ID,Name,Designation,Department,Type,Joined,Status";
    const lines = rows.map((e) => [e.employeeCode, e.name, e.designation ?? "", e.department ?? "", e.employmentType ? employmentTypeLabels[e.employmentType] : "", "", statusLabels[e.status]].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    downloadTextFile("staff-directory.csv", [header, ...lines].join("\n"));
  }

  const columns: ColumnDef<StaffListItemDto>[] = [
    {
      id: "name",
      header: "Employee",
      alwaysVisible: true,
      sortValue: (e) => e.name,
      cell: (e) => (
        <Link href={`/hr/staff/${e.id}`} className="flex min-w-0 items-center gap-sm">
          <EmployeeAvatar firstName={e.name.split(" ")[0] ?? e.name} lastName={e.name.split(" ")[1] ?? ""} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground underline-offset-2 hover:underline">{e.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{e.employeeCode} · {e.designation ?? "—"}</span>
          </span>
        </Link>
      ),
    },
    { id: "dept", header: "Department", cell: (e) => <span className="text-sm text-muted-foreground">{e.department ?? "—"}</span> },
    { id: "type", header: "Type", cell: (e) => <Badge tone="neutral">{e.employmentType ? employmentTypeLabels[e.employmentType] : "—"}</Badge>, defaultVisible: false },
    { id: "teaching", header: "Teaching", cell: (e) => <Badge tone={e.isTeaching ? "info" : "neutral"}>{e.isTeaching ? "Yes" : "No"}</Badge> },
    { id: "login", header: "Login", cell: (e) => <Badge tone={e.hasUser ? "success" : "neutral"}>{e.hasUser ? "Linked" : "None"}</Badge>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (e) => <Badge tone={statusTone[e.status]}>{statusLabels[e.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Staff directory</h1>
          <p className="text-xs text-muted-foreground">{staff.length} staff across {departments.length} department{departments.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-3.5" /> Export
          </Button>
          {canManage && (
            <Button asChild size="sm">
              <Link href="/hr/staff/new">
                <Plus className="size-3.5" /> Add staff
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
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" aria-label="Filter by status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(statusLabels) as StaffStatus[]).map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && staff.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
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
              <EmployeeAvatar firstName={e.name.split(" ")[0] ?? e.name} lastName={e.name.split(" ")[1] ?? ""} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{e.name}</p>
                  <Badge tone={statusTone[e.status]}>{statusLabels[e.status]}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{e.designation ?? "—"} · {e.department ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{e.employeeCode} · {e.isTeaching ? "Teaching" : "Non-teaching"}</p>
              </div>
            </Link>
          )}
        />
      )}

      <DetailDrawer open={preview !== null} onOpenChange={(o) => !o && setPreview(null)} title="Staff preview" description="Quick staff summary">
        {preview && (
          <div className="flex flex-col gap-md">
            <div className="flex items-center gap-sm">
              <EmployeeAvatar firstName={preview.name.split(" ")[0] ?? preview.name} lastName={preview.name.split(" ")[1] ?? ""} size="lg" />
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">{preview.name}</p>
                <p className="text-xs text-muted-foreground">{preview.designation ?? "—"} · {preview.department ?? "—"}</p>
                <Badge tone={statusTone[preview.status]} className="mt-1">{statusLabels[preview.status]}</Badge>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-sm text-sm">
              <Field label="Employee ID" value={preview.employeeCode} />
              <Field label="Type" value={preview.employmentType ? employmentTypeLabels[preview.employmentType] : "—"} />
              <Field label="Teaching" value={preview.isTeaching ? "Yes" : "No"} />
              <Field label="Login" value={preview.hasUser ? "Linked" : "Not linked"} />
              <Field label="Email" value={preview.email ?? "—"} />
              <Field label="Branch" value={preview.branchId} />
            </dl>
            <div className="flex gap-xs">
              <Button asChild size="sm">
                <Link href={`/hr/staff/${preview.id}`}>Open full profile</Link>
              </Button>
              {canPayroll && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/payroll/payslips">View payroll</Link>
                </Button>
              )}
            </div>
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
