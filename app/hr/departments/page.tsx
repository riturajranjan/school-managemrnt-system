"use client";

import Link from "next/link";
import { Network, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";

export default function DepartmentsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.view")) return <PermissionDenied action="view departments" role={roleLabels[role]} backHref="/hr" />;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Departments</h1>
          <p className="text-xs text-muted-foreground">{db.departments.length} departments · staffing and leave load</p>
        </div>
        <Button asChild size="sm" variant="outline"><Link href="/hr/org-chart"><Network className="size-3.5" /> Org chart</Link></Button>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {db.departments.map((dept) => {
          const staff = db.employees.filter((e) => e.departmentId === dept.id);
          const active = staff.filter((e) => e.status !== "inactive" && e.status !== "resigned" && e.status !== "retired");
          const onLeaveToday = db.hrAttendance.filter((a) => a.date === today && a.status === "on-leave" && staff.some((s) => s.id === a.employeeId)).length;
          const openings = db.recruitmentJobs.filter((j) => j.departmentId === dept.id && j.status === "open").reduce((s, j) => s + j.openings, 0);
          const head = db.employees.find((e) => e.id === dept.headEmployeeId);
          const avgAttendance = active.length ? Math.round(active.reduce((s, e) => s + e.attendancePercent, 0) / active.length) : 0;
          return (
            <div key={dept.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{dept.name}</p>
                  <p className="truncate text-xs text-muted-foreground">Head: {head ? `${head.firstName} ${head.lastName}` : "Unassigned"}</p>
                </div>
                <Badge tone={dept.colorTone}>{dept.code}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-sm text-center">
                <Metric label="Staff" value={String(active.length)} icon />
                <Metric label="Openings" value={String(openings)} tone={openings > 0 ? "text-warning" : undefined} />
                <Metric label="Attendance" value={`${avgAttendance}%`} tone={avgAttendance >= 90 ? "text-success" : "text-warning"} />
              </div>
              {onLeaveToday > 0 && <p className="text-xs text-muted-foreground">{onLeaveToday} on leave today</p>}
              <Link href={`/hr/staff?dept=${dept.id}`} className="text-xs font-medium text-primary">View staff →</Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: boolean }) {
  return (
    <div className="rounded-md border border-border p-sm">
      <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">{icon && <Users className="size-3" />}{label}</p>
      <p className={`text-sm font-semibold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
