"use client";

// Event participation (Phase 9U) — real ActivityEventParticipant status
// updates only. This is deliberately NOT academic Attendance — it never
// reads or writes AttendanceSession/AttendanceRecord.
import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { updateActivityParticipantRequest, useActivityEvent, useActivityEventParticipants } from "@/lib/hooks/api/use-activities-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function EventParticipationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: event } = useActivityEvent(id);
  const { data: participants, reload } = useActivityEventParticipants(id);

  if (!capabilitiesLoading && !hasServerPermission("activities.view")) return <PermissionDenied action="view participation" role={roleLabels[role]} backHref="/activities/events" />;
  if (!event) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Event not found. <Link href="/activities/events" className="text-primary">Back</Link></div>;

  const canManage = hasServerPermission("activities.manage");
  const eligible = participants.filter((p) => p.status !== "cancelled");
  const attendedCount = participants.filter((p) => p.status === "attended").length;

  async function mark(participantId: string, status: "attended" | "absent") {
    await updateActivityParticipantRequest(id, participantId, { status });
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href={`/activities/events/${id}`}><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-lg font-semibold text-foreground">Participation</h1><p className="text-xs text-muted-foreground">{event.title} · {attendedCount}/{eligible.length} attended</p></div>
      </div>

      <div className="flex flex-col gap-xs">
        {eligible.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="min-w-0"><p className="truncate font-medium text-foreground">{p.studentName}</p><p className="text-xs text-muted-foreground">{p.admissionNumber}</p></div>
            {canManage ? (
              <div className="flex gap-1">
                <Button size="sm" variant={p.status === "attended" ? "primary" : "outline"} onClick={() => mark(p.id, "attended")}><Check className="size-3.5" /> Attended</Button>
                <Button size="sm" variant={p.status === "absent" ? "primary" : "outline"} onClick={() => mark(p.id, "absent")}><X className="size-3.5" /> Absent</Button>
              </div>
            ) : <Badge tone={p.status === "attended" ? "success" : p.status === "absent" ? "neutral" : "info"}>{p.status}</Badge>}
          </div>
        ))}
        {eligible.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No registrations to mark.</div>}
      </div>
    </div>
  );
}
