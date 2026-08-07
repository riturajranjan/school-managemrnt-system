"use client";

import { useState } from "react";
import { Pill } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrivacyNotice } from "@/components/campus/privacy";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { recordMedication, setMedicationStatus } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { medicationStatusLabels, medicationStatusTone } from "@/lib/types/health";

export default function MedicationsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  if (!can("health.view")) return <PermissionDenied action="view medication records" role={roleLabels[role]} backHref="/health" />;
  if (!can("health.viewSensitive")) return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0"><div><h1 className="text-lg font-semibold text-foreground">Medication records</h1></div><PrivacyNotice /><div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Medication detail is restricted to authorised health staff.</div></div>
  );
  const canManage = can("health.manage");
  const studentName = (id: string) => { const s = db.students.find((x) => x.id === id); return s ? `${s.profile.firstName} ${s.profile.lastName}` : id; };
  const rows = [...db.medicationRecords].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Medication administration</h1><p className="text-xs text-muted-foreground">Record-keeping only — school-authorised medication</p></div>
      <PrivacyNotice />
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><Pill className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No medication records.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{studentName(m.studentId)} · {m.scheduledTime}</p><p className="truncate text-xs text-muted-foreground">{m.medicationName} · {m.doseAsRecorded} · {m.instructionsAsRecorded}</p><p className="text-xs text-muted-foreground">{m.guardianAuthorised ? "Guardian authorised" : "Authorisation pending"}</p></div>
              <div className="flex shrink-0 items-center gap-xs">
                <Badge tone={medicationStatusTone[m.status]}>{medicationStatusLabels[m.status]}</Badge>
                {canManage && (m.status === "due" || m.status === "scheduled") && <><Button size="sm" variant="outline" onClick={() => { recordMedication(m.id, "Nurse Anita"); force((n) => n + 1); }}>Record given</Button><Button size="sm" variant="ghost" onClick={() => { setMedicationStatus(m.id, "held"); force((n) => n + 1); }}>Hold</Button></>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
