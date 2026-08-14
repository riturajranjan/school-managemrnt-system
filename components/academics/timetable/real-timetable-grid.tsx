"use client";

// Real timetable grid (Phase 7B.2) — renders the weekly grid from REAL Phase-7
// DTOs (TimetablePeriodDto + TimetableEntryDto). Same visual structure as the
// former mock grid (sticky period column, break rows spanning the week, day
// columns, per-cell cards) but every value resolves through real ids; subject/
// teacher strings are display-only. No mock lookups, no client conflict engine.
import type { TimetableEntryDto, TimetablePeriodDto, Weekday } from "@/lib/api/contracts";
import { cn } from "@/lib/utils";

const DAY_ABBR: Record<Weekday, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };

export function RealTimetableGrid({
  periods,
  weekdays,
  entries,
  editable = false,
  onCellClick,
}: {
  periods: TimetablePeriodDto[];
  weekdays: Weekday[];
  entries: TimetableEntryDto[];
  /** When true, empty teaching cells are clickable to add and filled cells to edit. */
  editable?: boolean;
  onCellClick?: (weekday: Weekday, period: TimetablePeriodDto, entry: TimetableEntryDto | null) => void;
}) {
  const byCell = new Map<string, TimetableEntryDto>();
  for (const e of entries) byCell.set(`${e.weekday}-${e.periodId}`, e);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="max-h-[70vh] overflow-auto rounded-lg">
        <table className="w-full border-collapse text-xs" style={{ minWidth: `${80 + weekdays.length * 110}px` }}>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 w-20 border-b border-r border-border/70 bg-surface-secondary/70 p-1.5 text-left font-medium text-muted-foreground backdrop-blur-sm">
                Period
              </th>
              {weekdays.map((day) => (
                <th key={day} className="sticky top-0 z-10 border-b border-border/70 bg-surface-secondary/70 p-1.5 text-center font-medium text-muted-foreground backdrop-blur-sm">
                  {DAY_ABBR[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.id}>
                <td className="sticky left-0 z-10 border-b border-r border-border/70 bg-surface p-1.5 text-muted-foreground">
                  <div className="font-medium text-foreground">{period.name}</div>
                  <div className="text-[10px]">{period.startTime}</div>
                </td>
                {period.type === "break" ? (
                  <td colSpan={weekdays.length} className="border-b border-border/70 bg-surface-secondary/50 p-1 text-center text-[11px] font-medium text-muted-foreground">
                    {period.name} · {period.startTime}–{period.endTime}
                  </td>
                ) : (
                  weekdays.map((day) => {
                    const entry = byCell.get(`${day}-${period.id}`) ?? null;
                    const clickable = editable && Boolean(onCellClick);
                    return (
                      <td key={day} className="border-b border-border/40 p-0.5 align-top">
                        <button
                          type="button"
                          disabled={!clickable}
                          onClick={clickable ? () => onCellClick!(day, period, entry) : undefined}
                          className={cn(
                            "min-h-14 w-full rounded-md p-1.5 text-left align-top outline-none transition-colors",
                            entry ? "" : "text-muted-foreground",
                            clickable ? "hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring" : "cursor-default",
                          )}
                          aria-label={entry ? `${entry.subject.name} — ${entry.staff.name}` : clickable ? `Add lesson ${DAY_ABBR[day]} ${period.name}` : "Free period"}
                        >
                          {entry ? (
                            <span className="flex flex-col gap-0.5">
                              <span className="flex items-center gap-1 font-medium text-foreground">
                                <span className="inline-block size-2 shrink-0 rounded-pill" style={{ backgroundColor: entry.subject.color }} aria-hidden="true" />
                                <span className="truncate">{entry.subject.name}</span>
                              </span>
                              <span className="truncate text-[10px] text-muted-foreground">{entry.staff.name}</span>
                            </span>
                          ) : clickable ? (
                            <span className="text-[11px] text-muted-foreground/70">+</span>
                          ) : (
                            <span className="sr-only">Free</span>
                          )}
                        </button>
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
            {periods.length === 0 && (
              <tr>
                <td colSpan={weekdays.length + 1} className="p-md text-center text-sm text-muted-foreground">
                  No bell schedule configured for this branch/session yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
