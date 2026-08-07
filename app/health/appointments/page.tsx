"use client";

import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function HealthAppointmentsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("health.view")) return <PermissionDenied action="view health appointments" role={roleLabels[role]} backHref="/health" />;
  const studentName = (id: string) => { const s = db.students.find((x) => x.id === id); return s ? `${s.profile.firstName} ${s.profile.lastName}` : id; };
  const rows = [...db.healthAppointments].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Health appointments</h1><p className="text-xs text-muted-foreground">Follow-ups and routine checkups</p></div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><CalendarClock className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No appointments.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((a) => (
            <div key={a.id} className="flex items-center gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="flex w-16 shrink-0 flex-col items-center rounded-md bg-primary/10 py-1 text-primary"><span className="text-xs font-bold">{a.time}</span><span className="text-[10px]">{formatDate(a.date, { day: "2-digit", month: "short" })}</span></div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{studentName(a.studentId)}</p><p className="truncate text-xs text-muted-foreground">{a.purpose} · {a.staffName}</p></div>
              <Badge tone={a.status === "completed" ? "success" : a.status === "scheduled" ? "info" : "warning"}>{a.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
