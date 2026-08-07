"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, ClipboardCheck, ListChecks, MapPin, Trophy, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { advanceEventStage, cancelEvent, setEventTaskStatus } from "@/lib/services/activities-service";
import { roleLabels } from "@/lib/permissions/roles";
import { eventCategoryLabels, eventJourneyOrder, eventStageLabels, eventStageTone, eventTaskStatusLabels, eventTaskStatusTone } from "@/lib/types/activities";
import type { EventTaskStatus } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function Event360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);

  const event = db.schoolEvents.find((e) => e.id === id);
  const tasks = useMemo(() => db.eventTasks.filter((t) => t.eventId === id), [db.eventTasks, id]);
  const budget = useMemo(() => db.eventBudget.filter((b) => b.eventId === id), [db.eventBudget, id]);
  const regs = useMemo(() => db.eventRegistrations.filter((r) => r.eventId === id), [db.eventRegistrations, id]);

  if (!can("activities.view")) return <PermissionDenied action="view this event" role={roleLabels[role]} backHref="/activities/events" />;
  if (!event) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Event not found. <Link href="/activities/events" className="text-primary">Back</Link></div>;

  const canManage = can("activities.manageEvents");
  const stageIdx = eventJourneyOrder.indexOf(event.stage);
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const estTotal = budget.reduce((s, b) => s + b.estimated, 0);
  const actTotal = budget.reduce((s, b) => s + (b.actual ?? 0), 0);
  const nextStatus: Record<EventTaskStatus, EventTaskStatus> = { todo: "in-progress", "in-progress": "done", done: "todo", blocked: "todo" };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/events"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold text-foreground">{event.title}</h1><Badge tone={eventStageTone[event.stage]}>{eventStageLabels[event.stage]}</Badge></div>
          <p className="text-xs text-muted-foreground">{event.code} · {eventCategoryLabels[event.category]}</p>
        </div>
      </div>

      {/* Journey pipeline */}
      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between"><h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><CalendarClock className="size-4" /> Event Journey</h2><Link href={`/activities/events/${id}/journey`} className="text-xs text-primary">Full lifecycle →</Link></div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {eventJourneyOrder.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <span className={`whitespace-nowrap rounded-pill px-2.5 py-1 text-xs font-medium ${i < stageIdx ? "bg-success/15 text-success" : i === stageIdx ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground"}`}>{eventStageLabels[s]}</span>
              {i < eventJourneyOrder.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
        {canManage && event.stage !== "cancelled" && (
          <div className="mt-sm flex gap-xs">
            {stageIdx < eventJourneyOrder.length - 1 && <Button size="sm" onClick={() => { advanceEventStage(id); force((n) => n + 1); }}>Advance to {eventStageLabels[eventJourneyOrder[stageIdx + 1]]}</Button>}
            <Button size="sm" variant="ghost" onClick={() => { cancelEvent(id); force((n) => n + 1); }}>Cancel event</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Registered" value={String(event.registeredCount)} icon={Users} tone="info" />
        <StatTile label="Attended" value={String(event.attendedCount)} icon={ClipboardCheck} tone="success" />
        <StatTile label="Tasks done" value={`${doneTasks}/${tasks.length}`} icon={ListChecks} tone={doneTasks === tasks.length ? "success" : "warning"} />
        <StatTile label="Budget (est.)" value={`₹${(estTotal / 1000).toFixed(1)}k`} icon={Wallet} tone="neutral" hint={actTotal > 0 ? `₹${(actTotal / 1000).toFixed(1)}k actual` : undefined} />
      </div>

      {/* Quick links to sub-workspaces */}
      <div className="grid grid-cols-2 gap-xs sm:grid-cols-4">
        <Button asChild size="sm" variant="outline"><Link href={`/activities/events/${id}/registrations`}><Users className="size-3.5" /> Registrations</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href={`/activities/events/${id}/attendance`}><ClipboardCheck className="size-3.5" /> Attendance</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href={`/activities/events/${id}/results`}><Trophy className="size-3.5" /> Results</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href={`/activities/events/${id}/journey`}><CalendarClock className="size-3.5" /> Journey</Link></Button>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        {/* Overview */}
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Overview</h2>
          <p className="mb-sm text-sm text-muted-foreground">{event.description}</p>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Date</dt><dd className="text-foreground">{formatDate(event.startDate)}</dd>
            <dt className="text-muted-foreground">Time</dt><dd className="text-foreground">{event.allDay ? "All day" : `${event.startTime} – ${event.endTime}`}</dd>
            <dt className="flex items-center gap-1 text-muted-foreground"><MapPin className="size-3.5" /> Venue</dt><dd className="text-foreground">{event.venue}</dd>
            <dt className="text-muted-foreground">Organiser</dt><dd className="text-foreground">{event.organiserName}</dd>
            <dt className="text-muted-foreground">House-linked</dt><dd className="text-foreground">{event.houseLinked ? "Yes" : "No"}</dd>
          </dl>
        </div>

        {/* Tasks (Event 360 workspace) */}
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><ListChecks className="size-4" /> Planning tasks</h2>
          <div className="flex flex-col gap-xs">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <div className="min-w-0"><p className="truncate text-foreground">{t.title}</p><p className="truncate text-xs text-muted-foreground">{t.owner} · due {formatDate(t.dueDate)}</p></div>
                {canManage ? (
                  <button type="button" onClick={() => { setEventTaskStatus(t.id, nextStatus[t.status]); force((n) => n + 1); }}><Badge tone={eventTaskStatusTone[t.status]}>{eventTaskStatusLabels[t.status]}</Badge></button>
                ) : <Badge tone={eventTaskStatusTone[t.status]}>{eventTaskStatusLabels[t.status]}</Badge>}
              </div>
            ))}
            {tasks.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No planning tasks.</p>}
          </div>
        </div>

        {/* Budget */}
        {budget.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><Wallet className="size-4" /> Indicative budget</h2>
            <div className="flex flex-col gap-xs">
              {budget.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                  <span className="min-w-0 truncate text-foreground">{b.label}</span>
                  <span className="text-xs text-muted-foreground">₹{b.estimated.toLocaleString("en-IN")}{b.actual != null && <span className="ml-1 text-foreground">· ₹{b.actual.toLocaleString("en-IN")} act.</span>}</span>
                </div>
              ))}
            </div>
            <p className="mt-sm text-xs text-muted-foreground">Planning figures only — not a financial ledger entry.</p>
          </div>
        )}

        {/* Recent registrations preview */}
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><Users className="size-4" /> Registrations</h2><Link href={`/activities/events/${id}/registrations`} className="text-xs text-primary">Manage →</Link></div>
          <p className="text-sm text-muted-foreground">{regs.filter((r) => r.status === "confirmed").length} confirmed · {regs.filter((r) => r.status === "waitlisted").length} waitlisted · {regs.filter((r) => r.status === "pending").length} pending</p>
        </div>
      </div>
    </div>
  );
}
