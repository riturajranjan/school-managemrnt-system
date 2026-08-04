"use client";

import { AlertTriangle, CalendarClock, ListTree, MapPin, User } from "lucide-react";
import { useState } from "react";
import type { TimetableSlotStatus } from "../data/types";
import { fetchTodaysTimetable } from "../data/mock-data";
import { DetailDrawer } from "../detail-drawer";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell, widgetActionButtonClass } from "../widget-shell";

const STATUS_STYLE: Record<TimetableSlotStatus, string> = {
  completed: "text-muted-foreground",
  current: "font-semibold text-primary",
  upcoming: "text-muted-foreground",
};

export function TodaysTimetableWidget() {
  const state = useWidgetData(fetchTodaysTimetable);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const slots = state.status === "ready" ? state.data.slots : [];
  const current = slots.find((slot) => slot.status === "current") ?? null;
  const next = slots.find((slot) => slot.status === "upcoming") ?? null;
  const conflictCount = slots.filter((slot) => slot.conflict).length;

  return (
    <>
      <WidgetShell
        title="Today's Timetable"
        icon={CalendarClock}
        status={state.status}
        error={state.status === "error" ? state.error : undefined}
        onRetry={state.retry}
        isEmpty={state.status === "ready" && slots.length === 0}
        emptyMessage="No periods scheduled for today."
        action={
          state.status === "ready" ? (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={widgetActionButtonClass}
            >
              <ListTree className="size-3.5" aria-hidden="true" />
              Full timetable
            </button>
          ) : undefined
        }
      >
        {state.status === "ready" && (
          <div className="flex h-full flex-col gap-sm">
            {current && <PeriodCard label="Now" tone="current" slot={current} />}
            {next && <PeriodCard label="Next" tone="upcoming" slot={next} />}
            {!current && !next && <p className="text-sm text-muted-foreground">No more periods today.</p>}

            {conflictCount > 0 && (
              <div className="mt-auto flex items-center gap-xs rounded-md bg-error/15 px-sm py-xs text-xs font-medium text-error">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                {conflictCount} timetable conflict{conflictCount > 1 ? "s" : ""} today
              </div>
            )}
          </div>
        )}
      </WidgetShell>

      <DetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Full timetable"
        description="Every scheduled period today, including conflicts."
      >
        {state.status === "ready" && (
          <ul className="flex flex-col gap-1">
            {slots.map((slot) => (
              <li
                key={slot.id}
                className={`rounded-md border p-sm ${slot.conflict ? "border-error/40 bg-error/10" : "border-border"}`}
              >
                <div className="flex items-center justify-between gap-xs">
                  <span className={`text-sm ${STATUS_STYLE[slot.status]}`}>{slot.subject}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{slot.time}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-sm text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="size-3 shrink-0" aria-hidden="true" />
                    {slot.teacher}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3 shrink-0" aria-hidden="true" />
                    {slot.room}
                  </span>
                  {slot.status === "current" && (
                    <span className="rounded-pill bg-primary/15 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                      Now
                    </span>
                  )}
                </div>
                {slot.conflict && (
                  <p className="mt-1 flex items-start gap-xs text-xs font-medium text-error">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    {slot.conflict}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </DetailDrawer>
    </>
  );
}

function PeriodCard({
  label,
  tone,
  slot,
}: {
  label: string;
  tone: "current" | "upcoming";
  slot: { time: string; subject: string; teacher: string; room: string; conflict?: string };
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-md px-sm py-xs ${
        tone === "current" ? "bg-primary/10" : "bg-surface-secondary"
      }`}
    >
      <div className="flex items-center justify-between gap-xs">
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${
            tone === "current" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{slot.time}</span>
      </div>
      <p className="truncate text-sm font-medium text-foreground">{slot.subject}</p>
      <div className="flex flex-wrap items-center gap-sm text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="size-3 shrink-0" aria-hidden="true" />
          {slot.teacher}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          {slot.room}
        </span>
      </div>
      {slot.conflict && (
        <p className="flex items-start gap-xs text-xs font-medium text-error">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          {slot.conflict}
        </p>
      )}
    </div>
  );
}
