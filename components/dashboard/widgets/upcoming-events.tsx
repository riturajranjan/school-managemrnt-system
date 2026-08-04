"use client";

import {
  CalendarDays,
  Clock,
  FileClock,
  GraduationCap,
  MapPin,
  PartyPopper,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { EventCategory } from "../data/types";
import { fetchUpcomingEvents } from "../data/mock-data";
import { DetailDrawer } from "../detail-drawer";
import { toneClasses } from "../tone";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell } from "../widget-shell";

const CATEGORY_LABEL: Record<EventCategory, string> = {
  exam: "Exam",
  holiday: "Holiday",
  meeting: "Meeting",
  celebration: "Celebration",
  ptm: "Parent-teacher meeting",
  deadline: "Deadline",
};

const CATEGORY_ICON: Record<EventCategory, LucideIcon> = {
  exam: GraduationCap,
  holiday: Sun,
  meeting: Users,
  celebration: PartyPopper,
  ptm: Users,
  deadline: FileClock,
};

const CATEGORY_TONE: Record<EventCategory, keyof typeof toneClasses> = {
  exam: "info",
  holiday: "success",
  meeting: "neutral",
  celebration: "warning",
  ptm: "neutral",
  deadline: "error",
};

export function UpcomingEventsWidget() {
  const state = useWidgetData(fetchUpcomingEvents);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const events = state.status === "ready" ? state.data.events : [];
  const selected = events.find((event) => event.id === selectedId) ?? null;
  const SelectedIcon = selected ? CATEGORY_ICON[selected.category] : null;

  return (
    <>
      <WidgetShell
        title="Upcoming Events"
        icon={CalendarDays}
        status={state.status}
        error={state.status === "error" ? state.error : undefined}
        onRetry={state.retry}
        isEmpty={state.status === "ready" && events.length === 0}
        emptyMessage="No events scheduled yet."
      >
        <ul className="flex h-full flex-col gap-0.5 overflow-y-auto">
          {events.slice(0, 5).map((event) => {
            const Icon = CATEGORY_ICON[event.category];
            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(event.id)}
                  className="flex w-full min-h-11 items-center gap-sm rounded-md px-xs py-1 text-left outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className={`size-4 shrink-0 ${toneClasses[CATEGORY_TONE[event.category]].text}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{event.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{event.date}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </WidgetShell>

      <DetailDrawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selected?.title ?? "Event"}
      >
        {selected && (
          <div className="flex flex-col gap-md">
            <span
              className={`flex w-fit items-center gap-1 rounded-pill px-sm py-0.5 text-xs font-semibold uppercase tracking-wide ${toneClasses[CATEGORY_TONE[selected.category]].soft}`}
            >
              {SelectedIcon && <SelectedIcon className="size-3.5 shrink-0" aria-hidden="true" />}
              {CATEGORY_LABEL[selected.category]}
            </span>
            <dl className="flex flex-col gap-xs text-sm">
              <div className="flex justify-between border-b border-border py-xs">
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                  Date
                </dt>
                <dd className="text-foreground">{selected.date}</dd>
              </div>
              <div className="flex justify-between border-b border-border py-xs">
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                  Time
                </dt>
                <dd className="text-foreground">{selected.time}</dd>
              </div>
              <div className="flex justify-between border-b border-border py-xs">
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                  Location
                </dt>
                <dd className="text-foreground">{selected.location}</dd>
              </div>
            </dl>
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
