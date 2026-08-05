"use client";

import Papa from "papaparse";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Download, Plus, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAcademicEvents } from "@/lib/hooks/use-academics";
import { createAcademicEvent, duplicateAcademicEvent } from "@/lib/services/academics-service";
import { academicEventTypeTone, type AcademicEvent, type AcademicEventType } from "@/lib/types/academics";
import { formatDate } from "@/lib/utils";

type ViewMode = "month" | "agenda";
const eventTypes: AcademicEventType[] = ["holiday", "exam", "ptm", "event", "deadline", "admissions", "training", "sports", "activity", "custom"];

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

export default function AcademicCalendarPage() {
  const events = useAcademicEvents();
  const { role, can } = usePermissions();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AcademicEventType>("event");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");

  const audience = roleAudience[role] ?? "all";
  const visibleEvents = useMemo(
    () => events.filter((e) => e.audience.includes("all") || e.audience.includes(audience as AcademicEvent["audience"][number])),
    [events, audience],
  );

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - ((monthStart.getDay() + 6) % 7));
  const days: Date[] = [];
  for (let d = new Date(gridStart); days.length < 42; d.setDate(d.getDate() + 1)) days.push(new Date(d));

  function eventsOn(date: Date) {
    const key = date.toISOString().slice(0, 10);
    return visibleEvents.filter((e) => e.startDate.slice(0, 10) === key);
  }

  function exportCsv() {
    const csv = Papa.unparse(visibleEvents.map((e) => ({ Title: e.title, Type: e.type, Date: formatDate(e.startDate), Audience: e.audience.join(", ") })));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "academic-calendar.csv";
    a.click();
    URL.revokeObjectURL(url);
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
            {(["month", "agenda"] as ViewMode[]).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`min-h-11 rounded-md px-md text-xs font-medium capitalize transition-colors sm:min-h-8 ${view === v ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}>
                {v}
              </button>
            ))}
          </div>
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

      {view === "month" ? (
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
            {days.map((day) => {
              const dayEvents = eventsOn(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = day.toDateString() === new Date().toDateString();
              return (
                <div key={day.toISOString()} className={`min-h-24 border-b border-r border-border p-1 ${inMonth ? "bg-surface" : "bg-surface-secondary/20"}`}>
                  <span className={`text-xs ${isToday ? "flex size-5 items-center justify-center rounded-pill bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"}`}>{day.getDate()}</span>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {dayEvents.slice(0, 2).map((e) => (
                      <span key={e.id} className={`truncate rounded-sm px-1 py-0.5 text-[10px] font-medium ${academicEventTypeTone[e.type] === "error" ? "bg-error/15 text-error" : "bg-info/15 text-info"}`}>
                        {e.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 && <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-sm sm:hidden">
            {days
              .filter((d) => d.getMonth() === cursor.getMonth() && eventsOn(d).length > 0)
              .map((d) => (
                <div key={d.toISOString()} className="rounded-lg border border-border bg-surface p-sm">
                  <p className="text-xs font-medium text-muted-foreground">{formatDate(d.toISOString())}</p>
                  {eventsOn(d).map((e) => (
                    <div key={e.id} className="mt-1 flex items-center justify-between">
                      <span className="text-sm text-foreground">{e.title}</span>
                      <Badge tone={academicEventTypeTone[e.type]}>{e.type}</Badge>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      ) : (
        <ol className="flex flex-col gap-sm">
          {visibleEvents
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
            .map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(e.startDate)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-xs">
                  <Badge tone={academicEventTypeTone[e.type]}>{e.type}</Badge>
                  {can("calendar.manage") && (
                    <Button size="sm" variant="ghost" onClick={() => duplicateAcademicEvent(e.id, e.startDate)}>
                      <Copy className="size-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          {visibleEvents.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No events to show.</p>}
        </ol>
      )}

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
            <Label htmlFor="event-desc">Description</Label>
            <Textarea id="event-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button
            disabled={!title.trim()}
            onClick={() => {
              createAcademicEvent({ title: title.trim(), type, startDate: new Date(startDate).toISOString(), allDay: true, audience: ["all"], description, createdBy: "Administrator" });
              setCreateOpen(false);
              setTitle("");
              setDescription("");
            }}
          >
            Create event
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
