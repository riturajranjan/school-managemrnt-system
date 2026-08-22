"use client";

// HR Command Centre (Phase 9P) — real PostgreSQL/API cutover. DB-derived
// metrics only: present/absent/late/on-leave/not-marked reuse the canonical
// Phase 9E Staff Attendance summary. Dropped (no real backing anywhere in
// this system): People Pulse composite score, open positions, interviews
// today, contracts/documents expiring, appraisals pending, training overdue.
import Link from "next/link";
import { AlertTriangle, CalendarDays, ClipboardCheck, Network, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useShell } from "@/components/shell/shell-context";
import { useHrDashboard } from "@/lib/hooks/api/use-hr-api";
import { useStaffAttendanceRoster } from "@/lib/hooks/api/use-staff-attendance-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HrDashboardPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { activeSession } = useShell();
  const { data: summary } = useHrDashboard();
  const { data: roster } = useStaffAttendanceRoster(today());

  if (!capabilitiesLoading && !hasServerPermission("hr.view")) return <PermissionDenied action="view the HR command centre" role={roleLabels[role]} backHref="/hr/employee-self-service" />;

  const onLeave = (roster ?? []).filter((r) => r.status === "on-leave");
  const notMarked = (roster ?? []).filter((r) => r.status === "not-marked");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">HR Command Centre</h1>
          <p className="text-xs text-muted-foreground">{activeSession} · {formatDate(today())}</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <Button asChild size="sm">
            <Link href="/hr/staff/new">
              <UserPlus className="size-3.5" /> Add employee
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/hr/departments">
              <Network className="size-3.5" /> Departments
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/hr/leave">
              <CalendarDays className="size-3.5" /> Leave
            </Link>
          </Button>
        </div>
      </div>

      <section aria-label="HR summary" className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Active staff" value={String(summary?.activeStaff ?? 0)} icon={Users} tone="neutral" />
        <StatTile label="Present today" value={String(summary?.presentToday ?? 0)} icon={ClipboardCheck} tone="success" />
        <StatTile label="Absent today" value={String(summary?.absentToday ?? 0)} icon={AlertTriangle} tone={(summary?.absentToday ?? 0) > 0 ? "warning" : "success"} />
        <StatTile label="Late today" value={String(summary?.lateToday ?? 0)} icon={AlertTriangle} tone={(summary?.lateToday ?? 0) > 0 ? "warning" : "success"} />
        <StatTile label="On leave" value={String(summary?.onLeaveToday ?? 0)} icon={CalendarDays} tone="info" />
        <StatTile label="Not marked" value={String(summary?.notMarkedToday ?? 0)} icon={AlertTriangle} tone={(summary?.notMarkedToday ?? 0) > 0 ? "warning" : "success"} />
        <StatTile label="New hires (month)" value={String(summary?.newHiresThisMonth ?? 0)} icon={UserPlus} tone="neutral" />
        <StatTile label="Departments" value={String(summary?.departments ?? 0)} icon={Network} tone="neutral" />
      </section>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">On leave today</h2>
            <Badge tone={onLeave.length === 0 ? "success" : "info"}>{onLeave.length}</Badge>
          </div>
          {onLeave.length === 0 ? (
            <p className="py-md text-center text-sm text-muted-foreground">No one is on approved leave today.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {onLeave.map((r) => (
                <li key={r.staffId} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.designation ?? "—"} · {r.department ?? "—"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Not marked today</h2>
            <Badge tone={notMarked.length === 0 ? "success" : "warning"}>{notMarked.length}</Badge>
          </div>
          {notMarked.length === 0 ? (
            <p className="py-md text-center text-sm text-muted-foreground">All active staff are marked.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {notMarked.slice(0, 10).map((r) => (
                <li key={r.staffId} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.designation ?? "—"} · {r.department ?? "—"}</p>
                  </div>
                </li>
              ))}
              {notMarked.length > 10 && (
                <li>
                  <Link href="/attendance" className="text-xs font-medium text-primary">+{notMarked.length - 10} more →</Link>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-surface p-sm text-xs text-muted-foreground">
        Recruitment, contracts, documents, performance and training are not tracked in this system yet — see the <Link href="/hr" className="text-primary underline underline-offset-2">HR hub</Link> for those (still mock) sections.
      </div>
    </div>
  );
}
