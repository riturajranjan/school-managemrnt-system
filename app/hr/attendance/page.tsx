"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeeAvatar } from "@/components/hr/employee-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setAttendanceStatus } from "@/lib/services/hr-service";
import { roleLabels } from "@/lib/permissions/roles";
import { hrAttendanceStatusLabels, hrAttendanceStatusTone, type HrAttendanceStatus } from "@/lib/types/hr";

export default function HrAttendancePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const today = new Date().toISOString().slice(0, 10);
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [, force] = useState(0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.employees
      .filter((e) => e.status !== "resigned" && e.status !== "retired" && e.status !== "inactive")
      .filter((e) => (dept === "all" ? true : e.departmentId === dept))
      .filter((e) => (q ? `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) : true));
  }, [db.employees, query, dept]);

  if (!can("hr.view")) return <PermissionDenied action="view staff attendance" role={roleLabels[role]} backHref="/hr" />;
  const canManage = can("hr.manageAttendance");
  const statusFor = (id: string): HrAttendanceStatus => db.hrAttendance.find((a) => a.employeeId === id && a.date === today)?.status ?? "not-marked";

  const summary = { present: 0, absent: 0, late: 0, leave: 0 };
  for (const e of rows) {
    const s = statusFor(e.id);
    if (s === "present" || s === "work-from-home" || s === "official-duty") summary.present++;
    else if (s === "absent") summary.absent++;
    else if (s === "late") summary.late++;
    else if (s === "on-leave") summary.leave++;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Staff attendance</h1>
        <p className="text-xs text-muted-foreground">Today · {rows.length} staff · {summary.present} in, {summary.absent} absent, {summary.late} late, {summary.leave} on leave</p>
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff…" className="pl-8" aria-label="Search staff" />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-40" aria-label="Department"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {db.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <ClipboardCheck className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No staff match your filters.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((e) => {
            const status = statusFor(e.id);
            return (
              <div key={e.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
                <div className="flex min-w-0 items-center gap-sm">
                  <EmployeeAvatar firstName={e.firstName} lastName={e.lastName} color={e.photoColor} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{e.firstName} {e.lastName}</p>
                    <p className="truncate text-xs text-muted-foreground">{db.departments.find((d) => d.id === e.departmentId)?.name}</p>
                  </div>
                </div>
                {canManage ? (
                  <Select value={status} onValueChange={(v) => { setAttendanceStatus(e.id, today, v as HrAttendanceStatus); force((n) => n + 1); }}>
                    <SelectTrigger className="w-40" aria-label={`Attendance for ${e.firstName}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(hrAttendanceStatusLabels) as HrAttendanceStatus[]).map((s) => <SelectItem key={s} value={s}>{hrAttendanceStatusLabels[s]}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Badge tone={hrAttendanceStatusTone[status]}>{hrAttendanceStatusLabels[status]}</Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
