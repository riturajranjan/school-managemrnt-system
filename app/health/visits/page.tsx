"use client";

// Infirmary visits list (Phase 9R) — real PostgreSQL/API cutover.
import Link from "next/link";
import { HeartPulse, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useHealthVisits } from "@/lib/hooks/api/use-health-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { HealthVisitStatusDto } from "@/lib/api/contracts";
import { formatDateTime } from "@/lib/utils";

const statusTone: Record<HealthVisitStatusDto, "neutral" | "warning" | "error"> = { open: "warning", closed: "neutral", referred: "error" };
const statusLabel: Record<HealthVisitStatusDto, string> = { open: "Open", closed: "Closed", referred: "Referred" };

export default function HealthVisitsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: visits, meta } = useHealthVisits({ pageSize: 40 });
  if (!capabilitiesLoading && !hasServerPermission("health.view")) return <PermissionDenied action="view infirmary visits" role={roleLabels[role]} backHref="/health" />;
  const canManage = hasServerPermission("health.manage");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Infirmary visits</h1><p className="text-xs text-muted-foreground">{meta?.total ?? visits.length} records</p></div>
        {canManage && <Button asChild size="sm"><Link href="/health/visits/new"><HeartPulse className="size-3.5" /> Record visit</Link></Button>}
      </div>
      {visits.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><Stethoscope className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No visits recorded.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {visits.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{v.patientName}</p><p className="truncate text-xs text-muted-foreground">{v.reason ?? "Reason restricted"} · {formatDateTime(v.checkedInAt)} · {v.attendedByStaffName ?? "Unattended"}</p></div>
              <Badge tone={statusTone[v.status]}>{statusLabel[v.status]}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
