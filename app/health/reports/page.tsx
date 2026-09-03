"use client";

// Health Reports (Production migration, Phase C2) — pure aggregator over
// real HealthVisit + HealthMedicationAdministration data. No HealthReport
// model, no Incident/Appointment metric (neither is a modeled domain — see
// the Phase C2 audit), no fabricated trend/percentage/recovery-rate chart.
import { StatTile } from "@/components/ui/stat-tile";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useHealthReports } from "@/lib/hooks/api/use-health-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function HealthReportsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data, loading, error, reload } = useHealthReports();
  if (!capabilitiesLoading && !hasServerPermission("health.view")) return <PermissionDenied action="view health reports" role={roleLabels[role]} backHref="/health" />;

  const maxReason = data ? Math.max(1, ...data.visitsByReason.map((r) => r.count)) : 1;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Health reports</h1><p className="text-xs text-muted-foreground">Live aggregate administrative reporting — no sensitive-health analytics or fabricated trends</p></div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load health reports: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      )}

      {loading && !data ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading reports…</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
            <StatTile label="Visits (total)" value={String(data.totalVisits)} tone="neutral" />
            <StatTile label="Open now" value={String(data.openVisits)} tone={data.openVisits > 0 ? "warning" : "success"} />
            <StatTile label="Referred" value={String(data.referredVisits)} tone={data.referredVisits > 0 ? "warning" : "success"} />
            <StatTile label="Follow-ups pending" value={String(data.followUpsPending)} tone={data.followUpsPending > 0 ? "warning" : "success"} />
            <StatTile label="Closed" value={String(data.closedVisits)} tone="neutral" />
            <StatTile label="Medications recorded" value={String(data.medicationsRecorded)} tone="info" />
          </div>

          {data.visitsByReason.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-md">
              <h2 className="mb-sm text-sm font-semibold text-foreground">Visits by reason</h2>
              <div className="flex flex-col gap-sm">
                {data.visitsByReason.map(({ reason, count }) => (
                  <div key={reason} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm"><span className="text-foreground">{reason}</span><span className="text-muted-foreground">{count}</span></div>
                    <MiniBar percent={(count / maxReason) * 100} toneClassName="bg-primary" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
