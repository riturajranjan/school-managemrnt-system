"use client";

import { AlertTriangle, FlaskConical, Lock, Plus, Repeat } from "lucide-react";
import { useState } from "react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { assignmentsForSection, roomById, subjectById, teacherById } from "@/lib/data/seed/academics";
import { periodDefinitions, weekDays, type Timetable, type TimetableConflict, type TimetableSlot, type WeekDay } from "@/lib/types/timetable";
import { cn } from "@/lib/utils";

export function MobileDayView({
  timetable,
  conflicts = [],
  editable = false,
  initialDay,
  referenceDate,
  onSlotClick,
}: {
  timetable: Timetable;
  conflicts?: TimetableConflict[];
  editable?: boolean;
  initialDay?: WeekDay;
  referenceDate?: Date;
  onSlotClick?: (slot: TimetableSlot) => void;
}) {
  const now = referenceDate ?? new Date();
  const todayIndex = now.getDay() - 1;
  const [day, setDay] = useState<WeekDay>(initialDay ?? weekDays[todayIndex >= 0 && todayIndex < 6 ? todayIndex : 0]);
  const [detailSlot, setDetailSlot] = useState<TimetableSlot | null>(null);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const conflictBySlotId = new Map<string, TimetableConflict>();
  for (const conflict of conflicts) for (const id of conflict.slotIds) if (!conflictBySlotId.has(id)) conflictBySlotId.set(id, conflict);

  function handleSlotTap(slot: TimetableSlot) {
    if (editable && onSlotClick) onSlotClick(slot);
    else setDetailSlot(slot);
  }

  return (
    <div className="relative flex flex-col gap-sm">
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
          const conflict = slot ? conflictBySlotId.get(slot.id) : undefined;
          const assignment = slot?.subjectId ? assignmentsForSection(timetable.sectionId).find((a) => a.subjectId === slot.subjectId) : undefined;
          const isSubstitute = Boolean(slot?.teacherId && assignment && slot.teacherId !== assignment.primaryTeacherId);
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

          if (slot?.slotType === "break") {
            return (
              <li key={period.index} className="flex items-center gap-sm rounded-lg border border-dashed border-border/70 bg-surface-secondary/30 p-sm text-xs text-muted-foreground">
                <span className="w-16 shrink-0 font-medium text-foreground">{period.startTime}</span>
                <span>Break period</span>
              </li>
            );
          }

          return (
            <li key={period.index}>
              <button
                type="button"
                onClick={() => slot && handleSlotTap(slot)}
                className={cn(
                  "flex min-h-[52px] w-full items-center gap-sm rounded-lg border p-sm text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]",
                  isCurrent ? "border-primary bg-primary/5" : "border-border bg-surface",
                  conflict && "border-l-2 border-l-error",
                )}
                style={subject ? { backgroundColor: `${subject.color}12` } : undefined}
              >
                <div className="w-16 shrink-0 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{period.startTime}</p>
                  <p>{period.endTime}</p>
                </div>
                <div className="min-w-0 flex-1">
                  {subject ? (
                    <>
                      <p className="truncate text-sm font-semibold" style={{ color: subject.color }}>
                        {subject.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {teacherById(slot?.teacherId)?.name} {slot?.roomId ? `· ${roomById(slot.roomId)?.name}` : ""}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Free period</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {subject?.type === "practical" && <FlaskConical className="size-3 text-muted-foreground" aria-hidden="true" />}
                  {isSubstitute && <Repeat className="size-3 text-info" aria-hidden="true" />}
                  {slot?.locked && <Lock className="size-3 text-muted-foreground" aria-hidden="true" />}
                  {conflict && <AlertTriangle className="size-3 text-error" aria-hidden="true" />}
                  {isCurrent && <span className="rounded-pill bg-primary px-sm py-0.5 text-[10px] font-semibold text-primary-foreground">Now</span>}
                  {isNext && !isCurrent && <span className="rounded-pill bg-surface-secondary px-sm py-0.5 text-[10px] font-medium text-muted-foreground">Next</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {editable && (
        <Button
          size="icon"
          className="fixed bottom-[calc(var(--mobile-bottom-nav-height)_+_env(safe-area-inset-bottom)_+_1rem)] right-4 z-20 size-14 rounded-pill shadow-floating"
          aria-label="Add period"
          onClick={() => {
            const firstFree = timetable.slots.find((s) => s.day === day && !s.subjectId && s.slotType !== "break" && periodDefinitions.find((p) => p.index === s.periodIndex && !p.isBreak));
            if (firstFree) handleSlotTap(firstFree);
          }}
        >
          <Plus className="size-5" />
        </Button>
      )}

      <DetailDrawer
        open={detailSlot !== null}
        onOpenChange={(open) => !open && setDetailSlot(null)}
        title={detailSlot ? `${detailSlot.day} · Period ${detailSlot.periodIndex}` : ""}
        description="Period details"
      >
        {detailSlot && (
          <div className="flex flex-col gap-sm">
            {detailSlot.subjectId ? (
              <>
                <p className="text-base font-semibold text-foreground">{subjectById(detailSlot.subjectId)?.name}</p>
                <p className="text-sm text-muted-foreground">{teacherById(detailSlot.teacherId)?.name}</p>
                <p className="text-sm text-muted-foreground">{roomById(detailSlot.roomId)?.name}</p>
                <div className="flex flex-wrap gap-1">
                  {detailSlot.locked && <Badge tone="neutral">Locked</Badge>}
                  {conflictBySlotId.has(detailSlot.id) && <Badge tone="error">Conflict</Badge>}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">This is a free period.</p>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
