"use client";

import { useState } from "react";
import { Activity, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setVisitStatus } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { visitStatusLabels, visitStatusTone, type VisitStatus } from "@/lib/types/health";
import { timeAgo } from "@/lib/utils";

export default function InfirmaryBoardPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [shared, setShared] = useState(false);
  const [, force] = useState(0);
  if (!can("health.view")) return <PermissionDenied action="view the infirmary board" role={roleLabels[role]} backHref="/health" />;
  const canManage = can("health.manage");
  const canSensitive = can("health.viewSensitive");
  const studentName = (id: string) => { const st = db.students.find((x) => x.id === id); return st ? `${st.profile.firstName} ${st.profile.lastName}` : id; };
  const studentClass = (id: string) => db.students.find((x) => x.id === id)?.classId ?? "";

  const active = db.healthVisits.filter((v) => v.status !== "completed").sort((a, b) => a.arrivalAt.localeCompare(b.arrivalAt));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Infirmary board</h1><p className="text-xs text-muted-foreground">{active.length} active · operational view</p></div>
        <Button size="sm" variant={shared ? "primary" : "outline"} onClick={() => setShared((v) => !v)}><EyeOff className="size-3.5" /> {shared ? "Shared-display mode on" : "Shared-display mode"}</Button>
      </div>
      {shared && <p className="rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">Shared-display mode hides visit reasons and sensitive detail for public screens.</p>}

      {active.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><Activity className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No students in the infirmary right now.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {active.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{studentName(v.studentId)} <span className="text-xs text-muted-foreground">· {studentClass(v.studentId)}</span></p>
                <p className="truncate text-xs text-muted-foreground">
                  Arrived {timeAgo(v.arrivalAt)}{!shared && canSensitive ? ` · ${v.reason}` : ""} · {v.staffName}
                  {v.guardianContacted ? " · guardian contacted" : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-xs">
                <Badge tone={visitStatusTone[v.status]}>{visitStatusLabels[v.status]}</Badge>
                {canManage && !shared && (
                  <Select value={v.status} onValueChange={(x) => { setVisitStatus(v.id, x as VisitStatus); force((n) => n + 1); }}>
                    <SelectTrigger className="w-40" aria-label={`Status for ${studentName(v.studentId)}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(visitStatusLabels) as VisitStatus[]).map((x) => <SelectItem key={x} value={x}>{visitStatusLabels[x]}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
