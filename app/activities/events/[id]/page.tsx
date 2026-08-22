"use client";

// Event detail (Phase 9U) — real ActivityEvent lifecycle only. The mock's
// tasks/budget/8-stage journey had no real backing (no EventTask/
// EventBudgetLine model in this phase) and are dropped entirely.
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, CalendarClock, ClipboardCheck, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  cancelActivityEventRequest,
  completeActivityEventRequest,
  publishActivityEventRequest,
  useActivityEvent,
  useActivityEventParticipants,
} from "@/lib/hooks/api/use-activities-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

const statusTone = { draft: "neutral", published: "info", completed: "success", cancelled: "error" } as const;

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: event, loading, reload } = useActivityEvent(id);
  const { data: participants } = useActivityEventParticipants(id);
  const [error, setError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("activities.view")) return <PermissionDenied action="view this event" role={roleLabels[role]} backHref="/activities/events" />;
  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (!event) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Event not found. <Link href="/activities/events" className="text-primary">Back</Link></div>;

  const canManage = hasServerPermission("activities.manage");
  const registered = participants.filter((p) => p.status === "registered" || p.status === "attended").length;
  const attended = participants.filter((p) => p.status === "attended").length;

  async function transition(fn: () => Promise<{ success: boolean; error?: { message: string } }>) {
    const res = await fn();
    if (!res.success) setError(res.error!.message);
    else setError(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/events"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold text-foreground">{event.title}</h1><Badge tone={statusTone[event.status]}>{event.status}</Badge></div>
          <p className="text-xs text-muted-foreground">{event.activityName}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between"><h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><CalendarClock className="size-4" /> Lifecycle</h2></div>
        {error && <p className="mb-sm rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}
        {canManage && (
          <div className="flex gap-xs">
            {event.status === "draft" && <Button size="sm" onClick={() => transition(() => publishActivityEventRequest(id))}>Publish</Button>}
            {event.status === "published" && <Button size="sm" onClick={() => transition(() => completeActivityEventRequest(id))}>Mark completed</Button>}
            {(event.status === "draft" || event.status === "published") && <Button size="sm" variant="ghost" onClick={() => transition(() => cancelActivityEventRequest(id))}>Cancel event</Button>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        <StatTile label="Registered" value={String(registered)} icon={Users} tone="info" />
        <StatTile label="Attended" value={String(attended)} icon={ClipboardCheck} tone="success" />
        <StatTile label="Status" value={event.status} tone={event.status === "cancelled" ? "error" : "neutral"} />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Overview</h2>
          {event.description && <p className="mb-sm text-sm text-muted-foreground">{event.description}</p>}
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Starts</dt><dd className="text-foreground">{formatDate(event.startAt)}</dd>
            {event.endAt && (<><dt className="text-muted-foreground">Ends</dt><dd className="text-foreground">{formatDate(event.endAt)}</dd></>)}
            <dt className="flex items-center gap-1 text-muted-foreground"><MapPin className="size-3.5" /> Location</dt><dd className="text-foreground">{event.location ?? "—"}</dd>
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><Users className="size-4" /> Registrations</h2><Link href={`/activities/events/${id}/registrations`} className="text-xs text-primary">Manage →</Link></div>
          <p className="text-sm text-muted-foreground">{registered} registered · {attended} attended</p>
          <Link href={`/activities/events/${id}/attendance`} className="mt-sm inline-block text-xs text-primary">Mark attendance →</Link>
        </div>
      </div>
    </div>
  );
}
