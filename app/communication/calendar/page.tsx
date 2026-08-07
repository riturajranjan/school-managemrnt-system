"use client";

import { useState } from "react";
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

const kindTone: Record<string, "info" | "success" | "warning" | "neutral"> = { announcement: "info", broadcast: "success", meeting: "warning", "follow-up": "neutral", reminder: "warning", event: "success" };

export default function CommunicationCalendarPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [view, setView] = useState<"month" | "agenda">("agenda");
  const [monthOffset, setMonthOffset] = useState(0);

  if (!can("comm.view")) return <PermissionDenied action="view the communication calendar" role={roleLabels[role]} backHref="/communication" />;

  const items = [...db.scheduledCommunications].sort((a, b) => a.date.localeCompare(b.date));
  const base = new Date();
  base.setMonth(base.getMonth() + monthOffset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const monthLabel = base.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const itemsOn = (day: number) => items.filter((i) => i.date === `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Communication calendar</h1>
          <p className="text-xs text-muted-foreground">Scheduled announcements, broadcasts, meetings & follow-ups</p>
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          <button onClick={() => setView("agenda")} className={`flex items-center gap-1 rounded px-sm py-1.5 text-xs font-medium ${view === "agenda" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><ListChecks className="size-3.5" /> Agenda</button>
          <button onClick={() => setView("month")} className={`hidden items-center gap-1 rounded px-sm py-1.5 text-xs font-medium sm:flex ${view === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><CalendarDays className="size-3.5" /> Month</button>
        </div>
      </div>

      {view === "agenda" ? (
        <div className="flex flex-col gap-md">
          {Object.entries(items.reduce((acc, i) => { (acc[i.date] ??= []).push(i); return acc; }, {} as Record<string, typeof items>)).map(([date, list]) => (
            <div key={date}>
              <p className="mb-xs text-sm font-semibold text-foreground">{formatDate(date)}</p>
              <div className="flex flex-col gap-xs">
                {list.map((i) => (
                  <div key={i.id} className="flex items-center gap-sm rounded-md border border-border bg-surface p-sm">
                    <CalendarClock className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{i.title}{i.time ? ` · ${i.time}` : ""}</span>
                    <Badge tone={kindTone[i.kind]}>{i.kind}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Button size="icon" variant="outline" onClick={() => setMonthOffset((m) => m - 1)} aria-label="Previous month"><ChevronLeft className="size-4" /></Button>
            <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
            <Button size="icon" variant="outline" onClick={() => setMonthOffset((m) => m + 1)} aria-label="Next month"><ChevronRight className="size-4" /></Button>
          </div>
          <div className="overflow-x-auto">
            <div className="grid min-w-[560px] grid-cols-7 gap-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="p-1 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
              {cells.map((day, i) => (
                <div key={i} className={`min-h-16 rounded-md border p-1 ${day ? "border-border bg-surface" : "border-transparent"}`}>
                  {day && (
                    <>
                      <span className="text-xs font-medium text-muted-foreground">{day}</span>
                      <div className="mt-0.5 flex flex-col gap-0.5">
                        {itemsOn(day).slice(0, 2).map((it) => <span key={it.id} className="truncate rounded-sm bg-primary/10 px-1 text-[10px] text-primary" title={it.title}>{it.title}</span>)}
                        {itemsOn(day).length > 2 && <span className="text-[10px] text-muted-foreground">+{itemsOn(day).length - 2}</span>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
