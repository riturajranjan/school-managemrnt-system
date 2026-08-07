"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { markEventAttendance } from "@/lib/services/activities-service";
import { roleLabels } from "@/lib/permissions/roles";

export default function EventAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);

  const event = db.schoolEvents.find((e) => e.id === id);
  const confirmed = useMemo(() => db.eventRegistrations.filter((r) => r.eventId === id && r.status === "confirmed"), [db.eventRegistrations, id]);
  const attendance = useMemo(() => db.eventAttendance.filter((a) => a.eventId === id), [db.eventAttendance, id]);
  const studentName = (sid: string) => { const s = db.students.find((x) => x.id === sid); return s ? `${s.profile.firstName} ${s.profile.lastName}` : sid; };
  const presentOf = (sid: string) => attendance.find((a) => a.studentId === sid);

  if (!can("activities.view")) return <PermissionDenied action="view attendance" role={roleLabels[role]} backHref="/activities/events" />;
  if (!event) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Event not found. <Link href="/activities/events" className="text-primary">Back</Link></div>;

  const canManage = can("activities.manageRegistrations") || can("activities.manageEvents");
  const presentCount = attendance.filter((a) => a.present).length;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href={`/activities/events/${id}`}><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-lg font-semibold text-foreground">Attendance</h1><p className="text-xs text-muted-foreground">{event.title} · {presentCount}/{confirmed.length} present</p></div>
      </div>

      <div className="flex flex-col gap-xs">
        {confirmed.map((r) => {
          const att = presentOf(r.studentId);
          return (
            <div key={r.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
              <div className="min-w-0"><p className="truncate font-medium text-foreground">{studentName(r.studentId)}</p>{att?.checkInTime && <p className="text-xs text-muted-foreground">Checked in {att.checkInTime}</p>}</div>
              {canManage ? (
                <div className="flex gap-1">
                  <Button size="sm" variant={att?.present ? "primary" : "outline"} onClick={() => { markEventAttendance(id, r.studentId, true); force((n) => n + 1); }}><Check className="size-3.5" /> Present</Button>
                  <Button size="sm" variant={att && !att.present ? "primary" : "outline"} onClick={() => { markEventAttendance(id, r.studentId, false); force((n) => n + 1); }}><X className="size-3.5" /> Absent</Button>
                </div>
              ) : att ? <Badge tone={att.present ? "success" : "error"}>{att.present ? "Present" : "Absent"}</Badge> : <Badge tone="neutral">Not marked</Badge>}
            </div>
          );
        })}
        {confirmed.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No confirmed registrations to mark.</div>}
      </div>
    </div>
  );
}
