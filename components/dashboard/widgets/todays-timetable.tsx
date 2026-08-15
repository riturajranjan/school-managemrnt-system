"use client";

// Real PostgreSQL/API cutover (Phase 9A) — real TimetableEntry rows for the
// logged-in actor's own teaching Staff profile (GET /api/dashboard, which
// shares its query path with My Day). An actor with no real teaching Staff
// profile (e.g. most SCHOOL_ADMIN/PRINCIPAL accounts) has no personal
// timetable to show — an honest deferred state, never a fabricated one.
import { CalendarClock, ListTree, MapPin } from "lucide-react";
import { useState } from "react";
import { useSchoolDashboard } from "@/lib/hooks/api/use-dashboard-api";
import type { MyDayTimetableEntryDto } from "@/lib/api/contracts";
import { DetailDrawer } from "../detail-drawer";
import { WidgetShell, widgetActionButtonClass } from "../widget-shell";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function TodaysTimetableWidget() {
  const { data, loading, error } = useSchoolDashboard();
  const status = loading ? "loading" : error ? "error" : "ready";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const available = data?.todaysTimetable.available ?? false;
  const entries = data?.todaysTimetable.entries ?? [];
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const current = entries.find((e) => nowMinutes >= toMinutes(e.period.startTime) && nowMinutes < toMinutes(e.period.endTime)) ?? null;
  const next = entries.find((e) => toMinutes(e.period.startTime) > nowMinutes) ?? null;

  return (
    <>
      <WidgetShell
        title="Today's Timetable"
        icon={CalendarClock}
        status={status}
        error={error ? new Error(error) : undefined}
        isEmpty={status === "ready" && (!available || entries.length === 0)}
        emptyMessage={status === "ready" && !available ? "No personal teaching timetable — this account has no linked teaching Staff profile." : "No periods scheduled for today."}
        action={
          status === "ready" && available && entries.length > 0 ? (
            <button type="button" onClick={() => setDrawerOpen(true)} className={widgetActionButtonClass}>
              <ListTree className="size-3.5" aria-hidden="true" />
              Full timetable
            </button>
          ) : undefined
        }
      >
        {status === "ready" && available && entries.length > 0 && (
          <div className="flex h-full flex-col gap-sm">
            {current && <PeriodCard label="Now" tone="current" entry={current} />}
            {next && <PeriodCard label="Next" tone="upcoming" entry={next} />}
            {!current && !next && <p className="text-sm text-muted-foreground">No more periods today.</p>}
          </div>
        )}
      </WidgetShell>

      <DetailDrawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Full timetable" description="Every scheduled period today.">
        <ul className="flex flex-col gap-1">
          {entries.map((e) => (
            <li key={e.timetableEntryId} className="rounded-md border border-border p-sm">
              <div className="flex items-center justify-between gap-xs">
                <span className={`text-sm ${current?.timetableEntryId === e.timetableEntryId ? "font-semibold text-primary" : "text-foreground"}`}>{e.subject.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{e.period.startTime} – {e.period.endTime}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-sm text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 shrink-0" aria-hidden="true" />
                  {e.section.className}-{e.section.name}
                </span>
                {current?.timetableEntryId === e.timetableEntryId && (
                  <span className="rounded-pill bg-primary/15 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">Now</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </DetailDrawer>
    </>
  );
}

function PeriodCard({ label, tone, entry }: { label: string; tone: "current" | "upcoming"; entry: MyDayTimetableEntryDto }) {
  return (
    <div className={`flex flex-col gap-1 rounded-md px-sm py-xs ${tone === "current" ? "bg-primary/10" : "bg-surface-secondary"}`}>
      <div className="flex items-center justify-between gap-xs">
        <span className={`text-xs font-semibold uppercase tracking-wide ${tone === "current" ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
        <span className="text-xs text-muted-foreground">{entry.period.startTime}</span>
      </div>
      <p className="truncate text-sm font-medium text-foreground">{entry.subject.name}</p>
      <div className="flex flex-wrap items-center gap-sm text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          {entry.section.className}-{entry.section.name}
        </span>
      </div>
    </div>
  );
}
