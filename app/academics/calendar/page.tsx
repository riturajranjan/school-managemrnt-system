"use client";

import Papa from "papaparse";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Download, Plus, Printer, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAcademicEvents } from "@/lib/hooks/use-academics";
import { createAcademicEvent, duplicateAcademicEvent } from "@/lib/services/academics-service";
import { dateKey, expandOccurrences, type EventOccurrence } from "@/lib/selectors/calendar-occurrences";
import { academicEventTypeTone, type AcademicEvent, type AcademicEventType } from "@/lib/types/academics";
import { cn, formatDate } from "@/lib/utils";

type ViewMode = "month" | "week" | "agenda";
const eventTypes: AcademicEventType[] = ["holiday", "exam", "ptm", "event", "deadline", "admissions", "training", "sports", "activity", "custom"];
const recurringOptions: NonNullable<AcademicEvent["recurring"]>[] = ["none", "weekly", "yearly"];
const recurringLabels: Record<NonNullable<AcademicEvent["recurring"]>, string> = { none: "Does not repeat", weekly: "Repeats weekly", yearly: "Repeats yearly" };

const toneDot: Record<string, string> = { success: "bg-success", error: "bg-error", info: "bg-info", warning: "bg-warning", neutral: "bg-muted-foreground" };

const roleAudience: Record<string, string> = {
  "super-admin": "all",
  principal: "all",
  "academic-coordinator": "all",
  administrator: "staff",
  teacher: "teachers",
  parent: "parents",
  student: "students",
  accountant: "staff",
  "admission-officer": "staff",
};

function weekdayLabel(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}

export default function AcademicCalendarPage() {
  const events = useAcademicEvents();
  const { role, can } = usePermissions();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState<Set<AcademicEventType>>(new Set());
  const [preview, setPreview] = useState<EventOccurrence | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AcademicEventType>("event");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [recurring, setRecurring] = useState<NonNullable<AcademicEvent["recurring"]>>("none");

  const audience = roleAudience[role] ?? "all";
  const visibleEvents = useMemo(
    () => events.filter((e) => e.audience.includes("all") || e.audience.includes(audience as AcademicEvent["audience"][number])),
    [events, audience],
  );
  const filteredEvents = typeFilter.size === 0 ? visibleEvents : visibleEvents.filter((e) => typeFilter.has(e.type));

  const legend = useMemo(() => {
    const counts = new Map<AcademicEventType, number>();
    for (const e of visibleEvents) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    return eventTypes.filter((t) => (counts.get(t) ?? 0) > 0).map((t) => ({ type: t, count: counts.get(t) ?? 0 }));
  }, [visibleEvents]);

  function toggleType(t: AcademicEventType) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  const today = new Date();
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - ((monthStart.getDay() + 6) % 7));
  const monthDays: Date[] = [];
  for (let d = new Date(gridStart); monthDays.length < 42; d.setDate(d.getDate() + 1)) monthDays.push(new Date(d));

  const weekStart = new Date(cursor);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));

  const agendaEnd = new Date(today);
  agendaEnd.setDate(agendaEnd.getDate() + 180);

  const rangeStart = view === "month" ? monthDays[0] : view === "week" ? weekDays[0] : today;
  const rangeEnd = view === "month" ? monthDays[41] : view === "week" ? weekDays[6] : agendaEnd;
  const occurrences = expandOccurrences(filteredEvents, dateKey(rangeStart), dateKey(rangeEnd));

  const occurrencesByDay = new Map<string, EventOccurrence[]>();
  for (const occ of occurrences) occurrencesByDay.set(occ.date, [...(occurrencesByDay.get(occ.date) ?? []), occ]);

  function occurrencesOn(date: Date) {
    return occurrencesByDay.get(dateKey(date)) ?? [];
  }

  function exportCsv() {
    const csv = Papa.unparse(occurrences.map(({ event, date }) => ({ Title: event.title, Type: event.type, Date: formatDate(date), Audience: event.audience.join(", "), Repeats: event.recurring ?? "none" })));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "academic-calendar.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function goToday() {
    setCursor(new Date());
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Academic calendar</h1>
          <p className="text-xs text-muted-foreground">Holidays, exams, meetings and school events</p>
        </div>
        <div className="flex flex-wrap items-center gap-xs">
          <div className="flex items-center gap-1 rounded-md bg-surface-secondary p-1">
            {(["month", "week", "agenda"] as ViewMode[]).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`min-h-11 rounded-md px-md text-xs font-medium capitalize transition-colors sm:min-h-8 ${view === v ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}>
                {v}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={goToday}>
            <CalendarDays className="size-3.5" />
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-3.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print
          </Button>
          {can("calendar.manage") && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              Add event
            </Button>
          )}
        </div>
      </div>

      <div className="scrollbar-none flex flex-wrap items-center gap-1 overflow-x-auto">
        <span className="text-xs text-muted-foreground">Categories:</span>
        {legend.map(({ type: t, count }) => {
          const active = typeFilter.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-1 rounded-pill px-sm py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("size-1.5 rounded-pill", active ? "bg-primary-foreground" : toneDot[academicEventTypeTone[t]])} />
              {t} ({count})
            </button>
          );
        })}
        {typeFilter.size > 0 && (
          <button type="button" onClick={() => setTypeFilter(new Set())} className="text-[11px] font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            Clear
          </button>
        )}
      </div>

      {view === "month" && (
        <div className="flex flex-col gap-sm">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Button>
            <p className="text-sm font-semibold text-foreground">{cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-border sm:grid sm:grid-cols-7">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="border-b border-border bg-surface-secondary/60 p-1 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {monthDays.map((day) => {
              const dayOccurrences = occurrencesOn(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = day.toDateString() === today.toDateString();
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-24 border-b border-r border-border p-1",
                    inMonth ? "bg-surface" : "bg-surface-secondary/20",
                    isToday && "ring-2 ring-inset ring-primary/50",
                  )}
                >
                  <span className={`text-xs ${isToday ? "flex size-5 items-center justify-center rounded-pill bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"}`}>{day.getDate()}</span>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {dayOccurrences.slice(0, 2).map((occ) => (
                      <button
                        key={`${occ.event.id}-${occ.date}`}
                        type="button"
                        onClick={() => setPreview(occ)}
                        className={`truncate rounded-sm px-1 py-0.5 text-left text-[10px] font-medium outline-none focus-visible:ring-1 focus-visible:ring-ring ${academicEventTypeTone[occ.event.type] === "error" ? "bg-error/15 text-error" : "bg-info/15 text-info"}`}
                      >
                        {occ.event.title}
                      </button>
                    ))}
                    {dayOccurrences.length > 2 && <span className="text-[10px] text-muted-foreground">+{dayOccurrences.length - 2} more</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-sm sm:hidden">
            {monthDays
              .filter((d) => d.getMonth() === cursor.getMonth() && occurrencesOn(d).length > 0)
              .map((d) => (
                <div key={d.toISOString()} className={cn("rounded-lg border border-border bg-surface p-sm", d.toDateString() === today.toDateString() && "border-primary/50 ring-1 ring-primary/30")}>
                  <p className="text-xs font-medium text-muted-foreground">{formatDate(d.toISOString())}</p>
                  {occurrencesOn(d).map((occ) => (
                    <button key={`${occ.event.id}-${occ.date}`} type="button" onClick={() => setPreview(occ)} className="mt-1 flex w-full items-center justify-between gap-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="min-h-9 truncate text-sm text-foreground">{occ.event.title}</span>
                      <Badge tone={academicEventTypeTone[occ.event.type]}>{occ.event.type}</Badge>
                    </button>
                  ))}
                </div>
              ))}
            {monthDays.filter((d) => d.getMonth() === cursor.getMonth() && occurrencesOn(d).length > 0).length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No events this month.</p>
            )}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="flex flex-col gap-sm">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7))} aria-label="Previous week">
              <ChevronLeft className="size-4" />
            </Button>
            <p className="text-sm font-semibold text-foreground">
              {weekDays[0].toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {weekDays[6].toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7))} aria-label="Next week">
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-sm">
            {weekDays.map((d) => {
              const isToday = d.toDateString() === today.toDateString();
              const dayOccurrences = occurrencesOn(d);
              return (
                <div key={d.toISOString()} className={cn("rounded-lg border border-border bg-surface p-sm", isToday && "border-primary/50 ring-1 ring-primary/30")}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className={cn("flex size-6 items-center justify-center rounded-pill text-xs font-semibold", isToday ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-foreground")}>{d.getDate()}</span>
                    <span className="text-xs font-medium text-muted-foreground">{weekdayLabel(d)}</span>
                  </div>
                  {dayOccurrences.length === 0 ? (
                    <p className="pl-1 text-xs text-muted-foreground">No events</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {dayOccurrences.map((occ) => (
                        <button
                          key={`${occ.event.id}-${occ.date}`}
                          type="button"
                          onClick={() => setPreview(occ)}
                          className="flex min-h-9 items-center justify-between gap-sm rounded-md px-sm py-1 text-left text-sm outline-none hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="truncate text-foreground">{occ.event.title}</span>
                          <span className="flex shrink-0 items-center gap-1">
                            {occ.event.recurring && occ.event.recurring !== "none" && <Repeat className="size-3 text-muted-foreground" />}
                            <Badge tone={academicEventTypeTone[occ.event.type]}>{occ.event.type}</Badge>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "agenda" && (
        <ol className="flex flex-col gap-sm">
          {occurrences.map((occ) => (
            <li key={`${occ.event.id}-${occ.date}`} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <button type="button" onClick={() => setPreview(occ)} className="flex min-w-0 flex-1 items-center gap-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{occ.event.title}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {formatDate(occ.date)}
                    {occ.event.recurring && occ.event.recurring !== "none" && (
                      <span className="flex items-center gap-0.5">
                        <Repeat className="size-3" /> {recurringLabels[occ.event.recurring]}
                      </span>
                    )}
                  </p>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-xs">
                <Badge tone={academicEventTypeTone[occ.event.type]}>{occ.event.type}</Badge>
                {can("calendar.manage") && (
                  <Button size="sm" variant="ghost" onClick={() => duplicateAcademicEvent(occ.event.id, occ.date)} aria-label={`Duplicate ${occ.event.title}`}>
                    <Copy className="size-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
          {occurrences.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No events in the next 180 days.</p>}
        </ol>
      )}

      <DetailDrawer open={preview !== null} onOpenChange={(open) => !open && setPreview(null)} title={preview?.event.title ?? ""} description={preview ? formatDate(preview.date) : ""}>
        {preview && (
          <div className="flex flex-col gap-md">
            <div className="flex flex-wrap items-center gap-xs">
              <Badge tone={academicEventTypeTone[preview.event.type]}>{preview.event.type}</Badge>
              {preview.event.recurring && preview.event.recurring !== "none" && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Repeat className="size-3" /> {recurringLabels[preview.event.recurring]}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Audience</p>
              <p className="text-sm text-foreground capitalize">{preview.event.audience.join(", ")}</p>
            </div>
            {preview.event.description && (
              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm text-foreground">{preview.event.description}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Added by {preview.event.createdBy}</p>
            {can("calendar.manage") && (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => {
                  duplicateAcademicEvent(preview.event.id, preview.date);
                  setPreview(null);
                }}
              >
                <Copy className="size-3.5" />
                Duplicate this occurrence
              </Button>
            )}
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add event" description="Create a calendar event">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="event-title">Title</Label>
            <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AcademicEventType)}>
              <SelectTrigger aria-label="Event type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="event-date">Date</Label>
            <Input id="event-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>Repeats</Label>
            <Select value={recurring} onValueChange={(v) => setRecurring(v as NonNullable<AcademicEvent["recurring"]>)}>
              <SelectTrigger aria-label="Recurrence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recurringOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {recurringLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="event-desc">Description</Label>
            <Textarea id="event-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button
            disabled={!title.trim()}
            onClick={() => {
              createAcademicEvent({ title: title.trim(), type, startDate: new Date(startDate).toISOString(), allDay: true, audience: ["all"], description, recurring, createdBy: "Administrator" });
              setCreateOpen(false);
              setTitle("");
              setDescription("");
              setRecurring("none");
            }}
          >
            Create event
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
