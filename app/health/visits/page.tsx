"use client";

import Link from "next/link";
import { HeartPulse, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { visitStatusLabels, visitStatusTone } from "@/lib/types/health";
import { formatDateTime } from "@/lib/utils";

export default function HealthVisitsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("health.view")) return <PermissionDenied action="view infirmary visits" role={roleLabels[role]} backHref="/health" />;
  const canSensitive = can("health.viewSensitive");
  const studentName = (id: string) => { const s = db.students.find((x) => x.id === id); return s ? `${s.profile.firstName} ${s.profile.lastName}` : id; };
  const visits = [...db.healthVisits].sort((a, b) => b.arrivalAt.localeCompare(a.arrivalAt));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Infirmary visits</h1><p className="text-xs text-muted-foreground">{visits.length} records</p></div>
        {can("health.manage") && <Button asChild size="sm"><Link href="/health/visits/new"><HeartPulse className="size-3.5" /> Record visit</Link></Button>}
      </div>
      {visits.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><Stethoscope className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No visits recorded.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {visits.slice(0, 40).map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{studentName(v.studentId)}</p><p className="truncate text-xs text-muted-foreground">{canSensitive ? v.reason : "Reason restricted"} · {formatDateTime(v.arrivalAt)} · {v.staffName}</p></div>
              <Badge tone={visitStatusTone[v.status]}>{visitStatusLabels[v.status]}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
