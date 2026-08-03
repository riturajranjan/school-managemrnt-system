"use client";

import { CalendarClock } from "lucide-react";
import { fetchTodaysTimetable } from "../data/mock-data";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell } from "../widget-shell";

export function TodaysTimetableWidget() {
  const state = useWidgetData(fetchTodaysTimetable);

  return (
    <WidgetShell
      title="Today's Timetable"
      icon={CalendarClock}
      status={state.status}
      error={state.status === "error" ? state.error : undefined}
      onRetry={state.retry}
      isEmpty={state.status === "ready" && state.data.slots.length === 0}
      emptyMessage="No periods scheduled for today."
    >
      {state.status === "ready" && (
        <ul className="flex h-full flex-col gap-0.5">
          {state.data.slots.slice(0, 5).map((slot) => (
            <li
              key={slot.id}
              className={`flex items-center gap-sm rounded-md px-xs py-1 ${slot.isNow ? "bg-primary/10" : ""}`}
            >
              <span className={`w-20 shrink-0 text-xs ${slot.isNow ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                {slot.time}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{slot.subject}</span>
              <span className="shrink-0 truncate text-xs text-muted-foreground">{slot.room}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}
