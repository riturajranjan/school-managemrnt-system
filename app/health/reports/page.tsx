"use client";

import { StatTile } from "@/components/ui/stat-tile";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { healthSummary } from "@/lib/selectors/campus-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { incidentTypeLabels, type IncidentType } from "@/lib/types/health";

export default function HealthReportsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("health.view")) return <PermissionDenied action="view health reports" role={roleLabels[role]} backHref="/health" />;

  const s = healthSummary(db);
  // Visit reasons (aggregate, non-identifying).
  const byReason = new Map<string, number>();
  for (const v of db.healthVisits) byReason.set(v.reason, (byReason.get(v.reason) ?? 0) + 1);
  const maxReason = Math.max(1, ...byReason.values());
  const byIncident = new Map<IncidentType, number>();
  for (const i of db.healthIncidents) byIncident.set(i.type, (byIncident.get(i.type) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Health reports</h1><p className="text-xs text-muted-foreground">Aggregate administrative reporting only — no sensitive-health analytics</p></div>
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Visits (total)" value={String(db.healthVisits.length)} tone="neutral" />
        <StatTile label="Visits today" value={String(s.visitsToday)} tone="neutral" />
        <StatTile label="Incidents" value={String(db.healthIncidents.length)} tone="warning" />
        <StatTile label="Follow-ups" value={String(s.followUps)} tone="info" />
      </div>
      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Visits by reason</h2>
          <div className="flex flex-col gap-sm">{[...byReason.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
            <div key={reason} className="flex flex-col gap-1"><div className="flex items-center justify-between text-sm"><span className="text-foreground">{reason}</span><span className="text-muted-foreground">{count}</span></div><MiniBar percent={(count / maxReason) * 100} toneClassName="bg-primary" /></div>
          ))}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Incidents by type</h2>
          <div className="flex flex-col gap-xs">{[...byIncident.entries()].map(([t, count]) => (
            <div key={t} className="flex items-center justify-between text-sm"><span className="text-foreground">{incidentTypeLabels[t]}</span><span className="text-muted-foreground">{count}</span></div>
          ))}</div>
        </div>
      </div>
    </div>
  );
}
