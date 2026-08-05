"use client";

import { useState } from "react";
import { subjectById, teacherById, roomById } from "@/lib/data/seed/academics";
import { periodDefinitions, weekDays, type Timetable, type WeekDay } from "@/lib/types/timetable";
import { cn } from "@/lib/utils";

export function MobileDayView({ timetable }: { timetable: Timetable }) {
  const todayIndex = new Date().getDay() - 1;
  const [day, setDay] = useState<WeekDay>(weekDays[todayIndex >= 0 && todayIndex < 6 ? todayIndex : 0]);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="flex flex-col gap-sm">
      <div className="scrollbar-none flex gap-1 overflow-x-auto">
        {weekDays.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDay(d)}
            className={cn(
              "min-h-11 shrink-0 rounded-pill px-md text-xs font-medium transition-colors",
              day === d ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground",
            )}
          >
            {d.slice(0, 3)}
          </button>
        ))}
      </div>

      <ol className="flex flex-col gap-1">
        {periodDefinitions.map((period) => {
          const slot = timetable.slots.find((s) => s.day === day && s.periodIndex === period.index);
          const subject = slot?.subjectId ? subjectById(slot.subjectId) : undefined;
          const [startH, startM] = period.startTime.split(":").map(Number);
          const [endH, endM] = period.endTime.split(":").map(Number);
          const isCurrent = weekDays[todayIndex] === day && nowMinutes >= startH * 60 + startM && nowMinutes < endH * 60 + endM;
          const isNext = weekDays[todayIndex] === day && nowMinutes < startH * 60 + startM;

          if (period.isBreak) {
            return (
              <li key={period.index} className="rounded-md bg-surface-secondary/40 px-sm py-1.5 text-center text-xs text-muted-foreground">
                {period.label} · {period.startTime}–{period.endTime}
              </li>
            );
          }

          return (
            <li
              key={period.index}
              className={cn(
                "flex items-center gap-sm rounded-lg border p-sm",
                isCurrent ? "border-primary bg-primary/5" : "border-border bg-surface",
              )}
            >
              <div className="w-16 shrink-0 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{period.startTime}</p>
                <p>{period.endTime}</p>
              </div>
              <div className="min-w-0 flex-1">
                {subject ? (
                  <>
                    <p className="truncate text-sm font-medium text-foreground">{subject.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {teacherById(slot?.teacherId)?.name} {slot?.roomId ? `· ${roomById(slot.roomId)?.name}` : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Free period</p>
                )}
              </div>
              {isCurrent && <span className="shrink-0 rounded-pill bg-primary px-sm py-0.5 text-[10px] font-semibold text-primary-foreground">Now</span>}
              {isNext && !isCurrent && <span className="shrink-0 rounded-pill bg-surface-secondary px-sm py-0.5 text-[10px] font-medium text-muted-foreground">Next</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
