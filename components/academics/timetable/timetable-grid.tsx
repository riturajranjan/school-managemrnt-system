"use client";

import { Lock } from "lucide-react";
import { periodDefinitions, weekDays, type Timetable, type TimetableConflict, type TimetableSlot } from "@/lib/types/timetable";
import { subjectById, teacherById, roomById } from "@/lib/data/seed/academics";
import { cn } from "@/lib/utils";

function isCurrentPeriod(day: string, period: (typeof periodDefinitions)[number]): boolean {
  const now = new Date();
  const todayName = weekDays[now.getDay() - 1];
  if (todayName !== day) return false;
  const [startH, startM] = period.startTime.split(":").map(Number);
  const [endH, endM] = period.endTime.split(":").map(Number);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return minutesNow >= startH * 60 + startM && minutesNow < endH * 60 + endM;
}

export function TimetableGrid({
  timetable,
  conflicts = [],
  onSlotClick,
}: {
  timetable: Timetable;
  conflicts?: TimetableConflict[];
  onSlotClick?: (slot: TimetableSlot) => void;
}) {
  const conflictSlotIds = new Set(conflicts.flatMap((c) => c.slotIds));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-20 border-b border-r border-border bg-surface-secondary/60 p-1 text-left font-medium text-muted-foreground">Period</th>
            {weekDays.map((day) => (
              <th key={day} className="border-b border-border bg-surface-secondary/60 p-1 text-center font-medium text-muted-foreground">
                {day.slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periodDefinitions.map((period) => (
            <tr key={period.index}>
              <td className="sticky left-0 z-10 border-b border-r border-border bg-surface p-1 text-muted-foreground">
                <div className="font-medium text-foreground">{period.label}</div>
                <div>{period.startTime}</div>
              </td>
              {period.isBreak ? (
                <td colSpan={weekDays.length} className="border-b border-border bg-surface-secondary/40 p-1 text-center text-muted-foreground">
                  {period.label}
                </td>
              ) : (
                weekDays.map((day) => {
                  const slot = timetable.slots.find((s) => s.day === day && s.periodIndex === period.index);
                  const subject = slot?.subjectId ? subjectById(slot.subjectId) : undefined;
                  const hasConflict = slot ? conflictSlotIds.has(slot.id) : false;
                  const current = isCurrentPeriod(day, period);
                  return (
                    <td key={day} className={cn("border-b border-border p-0.5 align-top", current && "bg-primary/5")}>
                      <button
                        type="button"
                        disabled={!onSlotClick}
                        onClick={() => slot && onSlotClick?.(slot)}
                        className={cn(
                          "flex min-h-14 w-full flex-col items-start gap-0.5 rounded-md p-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                          subject ? "text-foreground" : "text-muted-foreground",
                          hasConflict && "ring-2 ring-error",
                          current && !hasConflict && "ring-1 ring-primary",
                          onSlotClick && "hover:bg-surface-secondary/60",
                        )}
                        style={subject ? { backgroundColor: `${subject.color}1f` } : undefined}
                      >
                        {subject ? (
                          <>
                            <span className="flex items-center gap-1 font-semibold" style={{ color: subject.color }}>
                              {subject.shortName}
                              {slot?.locked && <Lock className="size-2.5" />}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{teacherById(slot?.teacherId)?.name.split(" ")[0]}</span>
                            {slot?.roomId && <span className="text-[10px] text-muted-foreground">{roomById(slot.roomId)?.name}</span>}
                          </>
                        ) : (
                          <span className="text-[10px]">Free</span>
                        )}
                      </button>
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
