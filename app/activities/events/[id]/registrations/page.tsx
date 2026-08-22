"use client";

// Event registrations (Phase 9U) — real ActivityEventParticipant, real
// Student identity only. Duplicate registration surfaces the real 409 from
// the server (one registration per student per event).
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { registerActivityParticipantRequest, useActivityEvent, useActivityEventParticipants } from "@/lib/hooks/api/use-activities-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

const statusTone = { registered: "info", attended: "success", absent: "neutral", cancelled: "error" } as const;

export default function EventRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: event } = useActivityEvent(id);
  const { data: participants, reload } = useActivityEventParticipants(id);
  const { data: students } = useStudentList({ status: ["active"], pageSize: 300 });
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("activities.view")) return <PermissionDenied action="view registrations" role={roleLabels[role]} backHref="/activities/events" />;
  if (!event) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Event not found. <Link href="/activities/events" className="text-primary">Back</Link></div>;

  const canManage = hasServerPermission("activities.manage");
  const registeredIds = new Set(participants.filter((p) => p.status !== "cancelled").map((p) => p.studentId));
  const matches = query.trim() ? students.filter((s) => !registeredIds.has(s.id) && s.fullName.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];

  async function register(studentId: string) {
    const res = await registerActivityParticipantRequest(id, { studentId });
    if (!res.success) { setError(res.error.message); return; }
    setError(null); setQuery("");
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href={`/activities/events/${id}`}><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-lg font-semibold text-foreground">Registrations</h1><p className="text-xs text-muted-foreground">{event.title} · {participants.length} registrations</p></div>
      </div>

      {canManage && event.status === "published" && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Register a student</h2>
          {error && <p className="mb-sm rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student…" className="w-full rounded-md border border-border bg-surface px-sm py-1.5 text-sm text-foreground outline-none focus:border-primary" />
          <div className="mt-sm flex flex-wrap gap-1">
            {matches.map((s) => <Button key={s.id} size="sm" variant="outline" onClick={() => register(s.id)}><Plus className="size-3.5" /> {s.fullName}</Button>)}
          </div>
        </div>
      )}
      {canManage && event.status !== "published" && <p className="text-xs text-muted-foreground">Registrations are only open while the event is Published.</p>}

      <div className="flex flex-col gap-xs">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="min-w-0"><p className="truncate font-medium text-foreground">{p.studentName}</p><p className="truncate text-xs text-muted-foreground">{p.admissionNumber} · registered {formatDate(p.registeredAt)}</p></div>
            <Badge tone={statusTone[p.status]}>{p.status}</Badge>
          </div>
        ))}
        {participants.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No registrations yet.</div>}
      </div>
    </div>
  );
}
