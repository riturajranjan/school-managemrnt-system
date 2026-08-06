"use client";

import { useRef } from "react";
import { periodDefinitions, weekDays, type Timetable, type TimetableConflict, type TimetableSlot, type WeekDay } from "@/lib/types/timetable";
import { assignmentsForSection, roomById, subjectById, teacherById } from "@/lib/data/seed/academics";
import { cn } from "@/lib/utils";
import { TimetableCard, type TimetableCardDensity } from "./timetable-card";

const teachingPeriodList = periodDefinitions.filter((p) => !p.isBreak);

function isCurrentPeriod(day: string, period: (typeof periodDefinitions)[number], referenceDate: Date): boolean {
  const todayName = weekDays[referenceDate.getDay() - 1];
  if (todayName !== day) return false;
  const [startH, startM] = period.startTime.split(":").map(Number);
  const [endH, endM] = period.endTime.split(":").map(Number);
  const minutesNow = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  return minutesNow >= startH * 60 + startM && minutesNow < endH * 60 + endM;
}

export function TimetableGrid({
  timetable,
  conflicts = [],
  selectedConflict,
  editable = false,
  density = "comfortable",
  showFreeSlots = true,
  conflictOnly = false,
  referenceDate,
  visibleDays,
  onSlotClick,
}: {
  timetable: Timetable;
  conflicts?: TimetableConflict[];
  /** When set, that conflict's slots get the full ring and everything else in the grid dims slightly. */
  selectedConflict?: TimetableConflict | null;
  editable?: boolean;
  density?: TimetableCardDensity;
  showFreeSlots?: boolean;
  /** When true, every conflicted slot behaves like a selection (undimmed) and everything else dims — a page-level "show only conflicts" filter. */
  conflictOnly?: boolean;
  referenceDate?: Date;
  /** Restricts rendered day columns (tablet's 3-day range view); defaults to the full week. */
  visibleDays?: readonly WeekDay[];
  onSlotClick?: (slot: TimetableSlot) => void;
}) {
  const now = referenceDate ?? new Date();
  const days = visibleDays ?? weekDays;
  const conflictBySlotId = new Map<string, TimetableConflict>();
  for (const conflict of conflicts) {
    for (const slotId of conflict.slotIds) {
      // A slot can technically appear in more than one conflict; keep the first (highest-priority scan order).
      if (!conflictBySlotId.has(slotId)) conflictBySlotId.set(slotId, conflict);
    }
  }
  const selectedSlotIds = new Set(selectedConflict?.slotIds ?? []);
  const hasSelection = conflictOnly || selectedSlotIds.size > 0;
  const todayName = weekDays[now.getDay() - 1];

  const cellRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const focusableCells = days.flatMap((day) => teachingPeriodList.map((p) => `${day}-${p.index}`));

  function focusCell(key: string) {
    cellRefs.current.get(key)?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent, day: WeekDay, periodIndex: number) {
    const dayIdx = days.indexOf(day);
    const periodPos = teachingPeriodList.findIndex((p) => p.index === periodIndex);
    let targetKey: string | null = null;
    if (e.key === "ArrowRight") targetKey = dayIdx < days.length - 1 ? `${days[dayIdx + 1]}-${periodIndex}` : null;
    else if (e.key === "ArrowLeft") targetKey = dayIdx > 0 ? `${days[dayIdx - 1]}-${periodIndex}` : null;
    else if (e.key === "ArrowDown") targetKey = periodPos < teachingPeriodList.length - 1 ? `${day}-${teachingPeriodList[periodPos + 1].index}` : null;
    else if (e.key === "ArrowUp") targetKey = periodPos > 0 ? `${day}-${teachingPeriodList[periodPos - 1].index}` : null;
    if (targetKey && focusableCells.includes(targetKey)) {
      e.preventDefault();
      focusCell(targetKey);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="max-h-[70vh] overflow-auto rounded-lg">
        <table className="w-full border-collapse text-xs" style={{ minWidth: `${80 + days.length * 110}px` }}>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 w-20 border-b border-r border-border/70 bg-surface-secondary/70 p-1.5 text-left font-medium text-muted-foreground backdrop-blur-sm">
                Period
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  className={cn(
                    "sticky top-0 z-10 border-b border-border/70 p-1.5 text-center font-medium backdrop-blur-sm",
                    day === todayName ? "bg-primary/10 text-primary" : "bg-surface-secondary/70 text-muted-foreground",
                  )}
                >
                  {day.slice(0, 3)}
                  {day === todayName && <span className="ml-1 inline-block size-1 rounded-full bg-primary align-middle" aria-hidden="true" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periodDefinitions.map((period) => (
              <tr key={period.index}>
                <td className="sticky left-0 z-10 border-b border-r border-border/70 bg-surface p-1.5 text-muted-foreground">
                  <div className="font-medium text-foreground">{period.label}</div>
                  <div className="text-[10px]">{period.startTime}</div>
                </td>
                {period.isBreak ? (
                  <td colSpan={days.length} className="border-b border-border/70 bg-surface-secondary/50 p-1 text-center text-[11px] font-medium text-muted-foreground">
                    {period.label} · {period.startTime}–{period.endTime}
                  </td>
                ) : (
                  days.map((day) => {
                    const slot = timetable.slots.find((s) => s.day === day && s.periodIndex === period.index);
                    const subject = slot?.subjectId ? subjectById(slot.subjectId) : undefined;
                    const conflict = slot ? conflictBySlotId.get(slot.id) : undefined;
                    const assignment = slot?.subjectId ? assignmentsForSection(timetable.sectionId).find((a) => a.subjectId === slot.subjectId) : undefined;
                    const isSubstitute = Boolean(slot?.teacherId && assignment && slot.teacherId !== assignment.primaryTeacherId);
                    const current = isCurrentPeriod(day, period, now);
                    const key = `${day}-${period.index}`;
                    const isSelected = slot ? (conflictOnly ? Boolean(conflict) : selectedSlotIds.has(slot.id)) : false;
                    const isDimmed = hasSelection && !isSelected;

                    if (!showFreeSlots && !slot?.subjectId && slot?.slotType !== "break") {
                      return (
                        <td key={day} className={cn("border-b border-border/40 p-0.5 align-top", day === todayName && "bg-primary/[0.03]")}>
                          <div className={density === "compact" ? "min-h-11" : "min-h-14"} aria-hidden="true" />
                        </td>
                      );
                    }

                    return (
                      <td key={day} className={cn("border-b border-border/40 p-0.5 align-top", day === todayName && "bg-primary/[0.03]")}>
                        {slot && (
                          <TimetableCard
                            ref={(el) => {
                              cellRefs.current.set(key, el);
                            }}
                            slot={slot}
                            subject={subject}
                            teacherName={teacherById(slot.teacherId)?.name}
                            roomName={roomById(slot.roomId)?.name}
                            isLab={subject?.type === "practical" || roomById(slot.roomId)?.type === "lab"}
                            isSubstitute={isSubstitute}
                            hasConflict={Boolean(conflict)}
                            conflictLabel={conflict?.type === "teacher-double-booking" ? "Teacher overlap" : conflict?.type === "room-double-booking" ? "Room conflict" : conflict ? "Scheduling issue" : undefined}
                            isSelectedConflict={isSelected}
                            isDimmed={isDimmed}
                            isCurrent={current}
                            editable={editable}
                            density={density}
                            onClick={() => onSlotClick?.(slot)}
                            onKeyDown={(e) => handleKeyDown(e, day, period.index)}
                          />
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
