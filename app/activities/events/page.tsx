"use client";

// Events list (Phase 9U) — real ActivityEvent rows. The mock's 8-stage
// "Event Journey" is replaced by the real DRAFT/PUBLISHED/COMPLETED/
// CANCELLED lifecycle.
import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useActivityEvents } from "@/lib/hooks/api/use-activities-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { ActivityEventStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusTone = { draft: "neutral", published: "info", completed: "success", cancelled: "error" } as const;
const STATUSES: (ActivityEventStatusDto | "all")[] = ["all", "draft", "published", "completed", "cancelled"];

export default function EventsListPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ActivityEventStatusDto | "all">("all");
  const { data: events } = useActivityEvents(status === "all" ? {} : { status });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? events.filter((e) => e.title.toLowerCase().includes(q) || e.activityName.toLowerCase().includes(q)) : events;
  }, [events, query]);

  if (!capabilitiesLoading && !hasServerPermission("activities.view")) return <PermissionDenied action="view events" role={roleLabels[role]} backHref="/activities" />;
  const canManage = hasServerPermission("activities.manage");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Events</h1><p className="text-xs text-muted-foreground">{filtered.length} events</p></div>
        <div className="flex gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/activities/events/calendar"><CalendarDays className="size-3.5" /> Calendar</Link></Button>
          {canManage && <Button asChild size="sm"><Link href="/activities/events/new"><Plus className="size-3.5" /> New event</Link></Button>}
        </div>
      </div>

      <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events…" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>

      <div className="flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-pill px-2.5 py-1 text-xs font-medium capitalize transition ${status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground"}`}>{s}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((e) => (
          <Link key={e.id} href={`/activities/events/${e.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
            <div className="flex items-start justify-between gap-sm">
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{e.title}</p><p className="truncate text-xs text-muted-foreground">{e.activityName}</p></div>
              <Badge tone={statusTone[e.status]}>{e.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(e.startAt)}{e.location ? ` · ${e.location}` : ""}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{e.participantCount} registered</span></div>
          </Link>
        ))}
        {filtered.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No events match your filters.</div>}
      </div>
    </div>
  );
}
