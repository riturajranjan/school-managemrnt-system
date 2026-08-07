"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setIncidentStatus } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { incidentStatusTone, incidentTypeLabels, type IncidentStatus } from "@/lib/types/health";
import { formatDateTime } from "@/lib/utils";

export default function HealthIncidentsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  if (!can("health.view")) return <PermissionDenied action="view health incidents" role={roleLabels[role]} backHref="/health" />;
  const canManage = can("health.manage");
  const studentName = (id: string) => { const s = db.students.find((x) => x.id === id); return s ? `${s.profile.firstName} ${s.profile.lastName}` : id; };
  const rows = [...db.healthIncidents].sort((a, b) => Number(a.status === "closed" || a.status === "resolved") - Number(b.status === "closed" || b.status === "resolved") || b.occurredAt.localeCompare(a.occurredAt));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Health incidents</h1><p className="text-xs text-muted-foreground">{db.healthIncidents.filter((i) => i.status === "open" || i.status === "monitoring").length} open</p></div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><ShieldAlert className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No incidents.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((i) => (
            <div key={i.id} className="rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{i.reference} · {incidentTypeLabels[i.type]}</p><p className="truncate text-xs text-muted-foreground">{studentName(i.studentId)} · {i.location} · {formatDateTime(i.occurredAt)}</p><p className="truncate text-xs text-muted-foreground">{i.description} — {i.immediateAction}</p></div>
                {canManage ? <Select value={i.status} onValueChange={(v) => { setIncidentStatus(i.id, v as IncidentStatus); force((n) => n + 1); }}><SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger><SelectContent>{(["open", "monitoring", "guardian-contacted", "referred", "resolved", "closed"] as IncidentStatus[]).map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select> : <Badge tone={incidentStatusTone[i.status]}>{i.status}</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
