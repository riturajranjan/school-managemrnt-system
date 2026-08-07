"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { registerForEvent, setRegistrationStatus } from "@/lib/services/activities-service";
import { roleLabels } from "@/lib/permissions/roles";
import { registrationStatusLabels, registrationStatusTone } from "@/lib/types/activities";
import type { RegistrationStatus } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function EventRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const event = db.schoolEvents.find((e) => e.id === id);
  const regs = useMemo(() => db.eventRegistrations.filter((r) => r.eventId === id), [db.eventRegistrations, id]);
  const studentName = (sid: string) => { const s = db.students.find((x) => x.id === sid); return s ? `${s.profile.firstName} ${s.profile.lastName}` : sid; };
  const eligible = useMemo(() => db.students.filter((s) => !regs.some((r) => r.studentId === s.id && r.status !== "withdrawn" && r.status !== "declined")).slice(0, 30), [db.students, regs]);

  if (!can("activities.view")) return <PermissionDenied action="view registrations" role={roleLabels[role]} backHref="/activities/events" />;
  if (!event) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Event not found. <Link href="/activities/events" className="text-primary">Back</Link></div>;

  const canManage = can("activities.manageRegistrations") || can("activities.manageEvents");
  const cycle: Record<RegistrationStatus, RegistrationStatus> = { pending: "confirmed", confirmed: "waitlisted", waitlisted: "declined", declined: "confirmed", withdrawn: "confirmed" };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href={`/activities/events/${id}`}><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-lg font-semibold text-foreground">Registrations</h1><p className="text-xs text-muted-foreground">{event.title} · {regs.length} registrations</p></div>
      </div>

      {canManage && event.registrationMode !== "none" && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Add registration</h2>
          {error && <p className="mb-sm rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}
          <div className="flex flex-wrap gap-xs">
            {eligible.slice(0, 8).map((s) => (
              <Button key={s.id} size="sm" variant="outline" onClick={() => { const r = registerForEvent(id, s.id); if (!r.ok) setError(r.error); else setError(null); force((n) => n + 1); }}><Plus className="size-3.5" /> {s.profile.firstName} {s.profile.lastName}</Button>
            ))}
            {eligible.length === 0 && <p className="text-sm text-muted-foreground">All students already registered.</p>}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-xs">
        {regs.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="min-w-0"><p className="truncate font-medium text-foreground">{studentName(r.studentId)}</p><p className="truncate text-xs text-muted-foreground capitalize">{r.role} · registered {formatDate(r.registeredAt)}</p></div>
            {canManage ? (
              <button type="button" onClick={() => { setRegistrationStatus(r.id, cycle[r.status]); force((n) => n + 1); }}><Badge tone={registrationStatusTone[r.status]}>{registrationStatusLabels[r.status]}</Badge></button>
            ) : <Badge tone={registrationStatusTone[r.status]}>{registrationStatusLabels[r.status]}</Badge>}
          </div>
        ))}
        {regs.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No registrations yet.</div>}
      </div>
    </div>
  );
}
