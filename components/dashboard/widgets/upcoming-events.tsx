"use client";

import { CalendarDays } from "lucide-react";
import type { EventCategory } from "../data/types";
import { fetchUpcomingEvents } from "../data/mock-data";
import { toneClasses } from "../tone";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell } from "../widget-shell";

const CATEGORY_TONE: Record<EventCategory, keyof typeof toneClasses> = {
  academic: "info",
  sports: "success",
  cultural: "warning",
  meeting: "neutral",
};

export function UpcomingEventsWidget() {
  const state = useWidgetData(fetchUpcomingEvents);

  return (
    <WidgetShell
      title="Upcoming Events"
      icon={CalendarDays}
      status={state.status}
      error={state.status === "error" ? state.error : undefined}
      onRetry={state.retry}
      isEmpty={state.status === "ready" && state.data.events.length === 0}
      emptyMessage="No events scheduled yet."
    >
      {state.status === "ready" && (
        <ul className="flex h-full flex-col gap-0.5">
          {state.data.events.slice(0, 4).map((event) => (
            <li key={event.id} className="flex items-center gap-sm rounded-md px-xs py-1">
              <span className={`size-1.5 shrink-0 rounded-full ${toneClasses[CATEGORY_TONE[event.category]].dot}`} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{event.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{event.date}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}
