"use client";

// Event calendar (Phase 9U) — real ActivityEvent rows (the same source
// derived live into the Phase 9D Calendar). No second mock event calendar.
import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, List, Rows3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useActivityEvents } from "@/lib/hooks/api/use-activities-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

type View = "month" | "agenda" | "timeline";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const statusTone = { draft: "neutral", published: "info", completed: "success", cancelled: "error" } as const;

export default function EventCalendarPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const { data: allEvents } = useActivityEvents({});

  const events = useMemo(() => allEvents.filter((e) => e.status !== "cancelled"), [allEvents]);
  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) { const key = e.startAt.slice(0, 10); const arr = map.get(key) ?? []; arr.push(e); map.set(key, arr); }
    return map;
  }, [events]);

  if (!capabilitiesLoading && !hasServerPermission("activities.view")) return <PermissionDenied action="view the event calendar" role={roleLabels[role]} backHref="/activities" />;

  const firstDay = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const leading = firstDay.getDay();
  const cells: (number | null)[] = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const monthLabel = firstDay.toLocaleString("en-US", { month: "long", year: "numeric" });
  const todayStr = new Date().toISOString().slice(0, 10);
  const dateStr = (day: number) => `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const shift = (delta: number) => setCursor((c) => { const m = c.month + delta; return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 }; });

  const upcoming = [...events].filter((e) => e.startAt.slice(0, 10) >= todayStr).sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Event calendar</h1><p className="text-xs text-muted-foreground">{events.length} scheduled events</p></div>
        <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5">
          {([["month", CalendarDays], ["agenda", List], ["timeline", Rows3]] as const).map(([v, Icon]) => (
            <button key={v} type="button" onClick={() => setView(v)} className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium capitalize transition ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><Icon className="size-3.5" /> {v}</button>
          ))}
        </div>
      </div>

      {view === "month" && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{monthLabel}</h2>
            <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => shift(-1)}><ChevronLeft className="size-4" /></Button><Button size="sm" variant="ghost" onClick={() => shift(1)}><ChevronRight className="size-4" /></Button></div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">{WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} className="min-h-16 rounded-md" />;
              const ds = dateStr(day);
              const dayEvents = eventsByDate.get(ds) ?? [];
              const isToday = ds === todayStr;
              return (
                <div key={i} className={`min-h-16 rounded-md border p-1 text-left ${isToday ? "border-primary bg-primary/5" : "border-border"}`}>
                  <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {dayEvents.slice(0, 2).map((e) => <Link key={e.id} href={`/activities/events/${e.id}`} className="truncate rounded bg-surface-secondary px-1 py-0.5 text-[10px] text-foreground hover:text-primary">{e.title}</Link>)}
                    {dayEvents.length > 2 && <span className="px-1 text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "agenda" && (
        <div className="flex flex-col gap-sm">
          {upcoming.map((e) => (
            <Link key={e.id} href={`/activities/events/${e.id}`} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm transition hover:border-primary/40">
              <div className="flex items-center gap-sm"><div className="flex flex-col items-center rounded-md bg-surface-secondary px-2 py-1"><span className="text-xs font-bold text-foreground">{new Date(e.startAt).getDate()}</span><span className="text-[10px] uppercase text-muted-foreground">{new Date(e.startAt).toLocaleString("en-US", { month: "short" })}</span></div><div className="min-w-0"><p className="truncate font-medium text-foreground">{e.title}</p><p className="truncate text-xs text-muted-foreground">{e.activityName}{e.location ? ` · ${e.location}` : ""}</p></div></div>
              <Badge tone={statusTone[e.status]}>{e.status}</Badge>
            </Link>
          ))}
          {upcoming.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No upcoming events.</div>}
        </div>
      )}

      {view === "timeline" && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="flex flex-col gap-0 border-l-2 border-border pl-md">
            {upcoming.map((e) => (
              <div key={e.id} className="relative pb-md">
                <span className="absolute -left-[21px] top-1 size-3 rounded-full border-2 border-surface" style={{ backgroundColor: "var(--color-primary, #18b0c8)" }} />
                <p className="text-xs font-medium text-muted-foreground">{formatDate(e.startAt)}</p>
                <Link href={`/activities/events/${e.id}`} className="text-sm font-medium text-foreground hover:text-primary">{e.title}</Link>
                <p className="text-xs text-muted-foreground">{e.activityName}{e.location ? ` · ${e.location}` : ""}</p>
              </div>
            ))}
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming events.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
