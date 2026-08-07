"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import type { EventCategory, EventStage } from "@/lib/types/activities";
import { eventCategoryLabels, eventStageLabels, eventStageTone } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function EventsListPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<EventStage | "all">("all");
  const [category, setCategory] = useState<EventCategory | "all">("all");

  const events = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...db.schoolEvents]
      .filter((e) => (stage === "all" ? true : e.stage === stage))
      .filter((e) => (category === "all" ? true : e.category === category))
      .filter((e) => (q ? e.title.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q) : true))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [db.schoolEvents, query, stage, category]);

  if (!can("activities.view")) return <PermissionDenied action="view events" role={roleLabels[role]} backHref="/activities" />;

  const stages: (EventStage | "all")[] = ["all", "idea", "planning", "approved", "promotion", "live", "completed", "cancelled"];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Events</h1><p className="text-xs text-muted-foreground">{events.length} of {db.schoolEvents.length} events</p></div>
        <div className="flex gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/activities/events/calendar"><CalendarDays className="size-3.5" /> Calendar</Link></Button>
          {can("activities.manageEvents") && <Button asChild size="sm"><Link href="/activities/events/new"><Plus className="size-3.5" /> New event</Link></Button>}
        </div>
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events…" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>
        <select value={category} onChange={(e) => setCategory(e.target.value as EventCategory | "all")} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground">
          <option value="all">All categories</option>
          {Object.entries(eventCategoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-1">
        {stages.map((s) => (
          <button key={s} type="button" onClick={() => setStage(s)} className={`rounded-pill px-2.5 py-1 text-xs font-medium transition ${stage === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground"}`}>{s === "all" ? "All" : eventStageLabels[s]}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <Link key={e.id} href={`/activities/events/${e.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
            <div className="flex items-start justify-between gap-sm">
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{e.title}</p><p className="truncate text-xs text-muted-foreground">{e.code} · {eventCategoryLabels[e.category]}</p></div>
              <Badge tone={eventStageTone[e.stage]}>{eventStageLabels[e.stage]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(e.startDate)} · {e.startTime} · {e.venue}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{e.registeredCount} registered</span>
              {e.houseLinked && <Badge tone="info">House-linked</Badge>}
              {e.featured && <Badge tone="success">Featured</Badge>}
            </div>
          </Link>
        ))}
        {events.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No events match your filters.</div>}
      </div>
    </div>
  );
}
