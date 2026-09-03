"use client";

// Health hub (Phase 9R) — real PostgreSQL/API cutover for stat tiles.
// Medications and Reports went real in Phase C2 (real cross-visit medication
// log + real DB aggregates, both over the existing HealthVisit/
// HealthMedicationAdministration schema — no new model). Incidents and
// Appointments stay honestly deferred (not mock) — no real Incident or
// Appointment-scheduling domain exists; see app/health/incidents/page.tsx
// and app/health/appointments/page.tsx for why.
import Link from "next/link";
import { Activity, CalendarClock, ClipboardList, Gauge, HeartPulse, Pill, ShieldAlert, Stethoscope, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useHealthDashboard } from "@/lib/hooks/api/use-health-api";
import { roleLabels } from "@/lib/permissions/roles";

const links = [
  { href: "/health/infirmary", label: "Infirmary board", description: "Live operational board", icon: Activity },
  { href: "/health/visits", label: "Visits", description: "Infirmary visit records", icon: Stethoscope },
  { href: "/health/visits/new", label: "New visit", description: "Record an infirmary visit", icon: HeartPulse },
  { href: "/health/students", label: "Student health", description: "Health profiles (restricted)", icon: UsersRound },
  { href: "/health/medications", label: "Medications", description: "Authorised medication records", icon: Pill },
  { href: "/health/incidents", label: "Incidents", description: "Health incidents & follow-up", icon: ShieldAlert },
  { href: "/health/appointments", label: "Appointments", description: "Follow-ups and checkups", icon: CalendarClock },
  { href: "/health/reports", label: "Reports", description: "Aggregate visit reporting", icon: ClipboardList },
];

export default function HealthHubPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: dashboard } = useHealthDashboard();
  if (!capabilitiesLoading && !hasServerPermission("health.view")) return <PermissionDenied action="view the health module" role={roleLabels[role]} backHref="/campus-life" />;
  const s = dashboard ?? { visitsToday: 0, openVisits: 0, referredToday: 0, followUpsDue: 0 };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Health & Infirmary</h1><p className="text-xs text-muted-foreground">Administrative record-keeping — not diagnosis software</p></div>
        <Button asChild size="sm"><Link href="/health/dashboard"><Gauge className="size-3.5" /> Command Centre</Link></Button>
      </div>
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Visits today" value={String(s.visitsToday)} icon={Stethoscope} tone="neutral" />
        <StatTile label="Open now" value={String(s.openVisits)} tone={s.openVisits > 0 ? "warning" : "success"} />
        <StatTile label="Referred today" value={String(s.referredToday)} icon={ShieldAlert} tone={s.referredToday > 0 ? "warning" : "success"} />
        <StatTile label="Follow-ups due" value={String(s.followUpsDue)} icon={CalendarClock} tone={s.followUpsDue > 0 ? "warning" : "success"} />
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {links.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" /></span>
            <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{label}</p><p className="truncate text-xs text-muted-foreground">{description}</p></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
