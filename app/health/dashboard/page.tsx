"use client";

import Link from "next/link";
import { Activity, CalendarClock, HeartPulse, Pill, ShieldAlert, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PrivacyNotice } from "@/components/campus/privacy";
import { PermissionDenied } from "@/components/library/permission-denied";
import { useShell } from "@/components/shell/shell-context";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { healthSummary } from "@/lib/selectors/campus-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { medicationStatusLabels, medicationStatusTone, visitStatusLabels, visitStatusTone } from "@/lib/types/health";
import { formatDate, timeAgo } from "@/lib/utils";

export default function HealthDashboardPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const { activeSession } = useShell();
  if (!can("health.view")) return <PermissionDenied action="view the health command centre" role={roleLabels[role]} backHref="/health" />;

  const s = healthSummary(db);
  const canSensitive = can("health.viewSensitive");
  const studentName = (id: string) => { const st = db.students.find((x) => x.id === id); return st ? `${st.profile.firstName} ${st.profile.lastName}` : id; };
  const activeVisits = db.healthVisits.filter((v) => v.status !== "completed").sort((a, b) => b.arrivalAt.localeCompare(a.arrivalAt));
  const medsDue = db.medicationRecords.filter((m) => m.status === "due" || m.status === "scheduled").slice(0, 6);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm lg:flex-row lg:items-center lg:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Health Command Centre</h1><p className="text-xs text-muted-foreground">Infirmary operations · {activeSession}</p></div>
        {can("health.manage") && <Button asChild size="sm"><Link href="/health/visits/new"><HeartPulse className="size-3.5" /> Record visit</Link></Button>}
      </div>

      <PrivacyNotice />

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Visits today" value={String(s.visitsToday)} icon={Stethoscope} tone="neutral" />
        <StatTile label="Resting" value={String(s.resting)} icon={Activity} tone={s.resting > 0 ? "warning" : "success"} />
        <StatTile label="Follow-ups" value={String(s.followUps)} icon={CalendarClock} tone="info" />
        <StatTile label="Appointments" value={String(s.appointments)} icon={CalendarClock} tone="neutral" />
        <StatTile label="Open incidents" value={String(s.openIncidents)} icon={ShieldAlert} tone={s.openIncidents > 0 ? "warning" : "success"} />
        <StatTile label="Meds due" value={String(s.medicationsDue)} icon={Pill} tone={s.medicationsDue > 0 ? "warning" : "success"} />
      </section>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Infirmary now</h2><Link href="/health/infirmary" className="text-xs text-primary">Live board →</Link></div>
          {activeVisits.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">No active visits.</p> : (
            <div className="flex flex-col gap-xs">{activeVisits.slice(0, 6).map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{studentName(v.studentId)}</p><p className="truncate text-xs text-muted-foreground">{canSensitive ? v.reason : "Visit reason restricted"} · {timeAgo(v.arrivalAt)}</p></div>
                <Badge tone={visitStatusTone[v.status]}>{visitStatusLabels[v.status]}</Badge>
              </div>
            ))}</div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Medications due</h2><Link href="/health/medications" className="text-xs text-primary">All →</Link></div>
          {medsDue.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">Nothing due.</p> : (
            <div className="flex flex-col gap-xs">{medsDue.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{studentName(m.studentId)}</p><p className="truncate text-xs text-muted-foreground">{m.scheduledTime} · {canSensitive ? m.medicationName : "Medication restricted"}</p></div>
                <Badge tone={medicationStatusTone[m.status]}>{medicationStatusLabels[m.status]}</Badge>
              </div>
            ))}</div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Follow-ups due today: {db.healthAppointments.filter((a) => a.status === "scheduled" && a.date === new Date().toISOString().slice(0, 10)).map((a) => formatDate(a.date)).length} appointment(s).</p>
    </div>
  );
}
