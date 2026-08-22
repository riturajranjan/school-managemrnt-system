"use client";

// Health Command Centre (Phase 9R) — real PostgreSQL/API cutover. DB-derived
// counts only; the "medications due" concept is dropped (it implied a
// schedule/prescription authority we don't have) — replaced with real
// "referred today" + "follow-ups due" counts.
import Link from "next/link";
import { Activity, CalendarClock, HeartPulse, ShieldAlert, Stethoscope, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PrivacyNotice } from "@/components/campus/privacy";
import { PermissionDenied } from "@/components/library/permission-denied";
import { useShell } from "@/components/shell/shell-context";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useHealthDashboard, useHealthVisits } from "@/lib/hooks/api/use-health-api";
import { roleLabels } from "@/lib/permissions/roles";
import { timeAgo } from "@/lib/utils";

export default function HealthDashboardPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { activeSession } = useShell();
  const { data: dashboard } = useHealthDashboard();
  const { data: openVisits } = useHealthVisits({ status: "open", pageSize: 6 });
  const { data: referred } = useHealthVisits({ status: "referred", pageSize: 6 });

  if (!capabilitiesLoading && !hasServerPermission("health.view")) return <PermissionDenied action="view the health command centre" role={roleLabels[role]} backHref="/health" />;
  const canManage = hasServerPermission("health.manage");
  const s = dashboard ?? { visitsToday: 0, studentVisitsToday: 0, staffVisitsToday: 0, openVisits: 0, referredToday: 0, followUpsDue: 0, medicationsRecordedToday: 0 };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm lg:flex-row lg:items-center lg:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Health Command Centre</h1><p className="text-xs text-muted-foreground">Infirmary operations · {activeSession}</p></div>
        {canManage && <Button asChild size="sm"><Link href="/health/visits/new"><HeartPulse className="size-3.5" /> Record visit</Link></Button>}
      </div>

      <PrivacyNotice />

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Visits today" value={String(s.visitsToday)} icon={Stethoscope} tone="neutral" />
        <StatTile label="Student visits" value={String(s.studentVisitsToday)} icon={UsersRound} tone="neutral" />
        <StatTile label="Staff visits" value={String(s.staffVisitsToday)} icon={UsersRound} tone="neutral" />
        <StatTile label="Open now" value={String(s.openVisits)} icon={Activity} tone={s.openVisits > 0 ? "warning" : "success"} />
        <StatTile label="Referred today" value={String(s.referredToday)} icon={ShieldAlert} tone={s.referredToday > 0 ? "warning" : "success"} />
        <StatTile label="Follow-ups due" value={String(s.followUpsDue)} icon={CalendarClock} tone={s.followUpsDue > 0 ? "warning" : "success"} />
      </section>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Infirmary now</h2><Link href="/health/infirmary" className="text-xs text-primary">Live board →</Link></div>
          {openVisits.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">No active visits.</p> : (
            <div className="flex flex-col gap-xs">{openVisits.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{v.patientName}</p><p className="truncate text-xs text-muted-foreground">{v.reason ?? "Visit reason restricted"} · {timeAgo(v.checkedInAt)}</p></div>
                <Badge tone="warning">Open</Badge>
              </div>
            ))}</div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Recent referrals</h2></div>
          {referred.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">No referrals recorded.</p> : (
            <div className="flex flex-col gap-xs">{referred.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{v.patientName}</p><p className="truncate text-xs text-muted-foreground">{v.referralDestination ?? "Destination restricted"} · {timeAgo(v.checkedOutAt ?? v.checkedInAt)}</p></div>
                <Badge tone="error">Referred</Badge>
              </div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  );
}
