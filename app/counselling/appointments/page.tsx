"use client";

import { useState } from "react";
import { CalendarClock, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrivacyNotice } from "@/components/campus/privacy";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setCounsellingStatus } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { counsellingAppointmentTypeLabels, counsellingStatusLabels, counsellingStatusTone } from "@/lib/types/health";
import { formatDate } from "@/lib/utils";

export default function CounsellingAppointmentsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  if (!can("counselling.view")) return <PermissionDenied action="view counselling appointments" role={roleLabels[role]} backHref="/counselling" />;
  const canPrivate = can("counselling.private");
  const canManage = can("counselling.manage");
  const studentName = (id: string) => { const s = db.students.find((x) => x.id === id); return s ? `${s.profile.firstName} ${s.profile.lastName}` : id; };
  const rows = [...db.counsellingAppointments].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Counselling appointments</h1><p className="text-xs text-muted-foreground">{rows.length} appointments</p></div>
      <PrivacyNotice kind="counselling" />
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><CalendarClock className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No appointments.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((a) => (
            <div key={a.id} className="rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{canPrivate ? studentName(a.studentId) : "Student — approved appointment"}</p>
                  <p className="truncate text-xs text-muted-foreground">{formatDate(a.date)} {a.time} · {a.counsellorName}{canPrivate ? ` · ${counsellingAppointmentTypeLabels[a.type]}` : ""}</p>
                  {canPrivate && a.adminReasonCategory && <p className="text-xs text-muted-foreground">Category: {a.adminReasonCategory}</p>}
                </div>
                <Badge tone={counsellingStatusTone[a.status]}>{counsellingStatusLabels[a.status]}</Badge>
              </div>
              {canPrivate ? (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-1 rounded-md border border-dashed border-warning/40 bg-warning/8 p-sm text-xs text-warning"><Lock className="size-3.5" /> {a.privateNotePlaceholder ?? "Private session notes (counsellor access only)."}</div>
                  {canManage && a.status !== "completed" && a.status !== "cancelled" && (
                    <div className="flex gap-xs"><Button size="sm" variant="outline" onClick={() => { setCounsellingStatus(a.id, "completed"); force((n) => n + 1); }}>Mark completed</Button><Button size="sm" variant="ghost" onClick={() => { setCounsellingStatus(a.id, "follow-up"); force((n) => n + 1); }}>Follow-up</Button></div>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Private details are restricted to counsellors.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
