"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useInView } from "@/lib/hooks/use-in-view";
import type { AttendanceStatus } from "@/lib/types/attendance";
import { attendanceStatusTone } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";
import { toneClasses } from "@/components/dashboard/tone";

const SEATS_PER_ROW = 5;

// Minimal seat shape — a real attendance roster entry (id + display name).
export type SeatEntry = { id: string; name: string };
function seatInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
const firstToken = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function SeatingView({
  students,
  statusFor,
  onToggle,
}: {
  students: SeatEntry[];
  statusFor: (studentId: string) => AttendanceStatus;
  onToggle: (studentId: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const rows: SeatEntry[][] = [];
  for (let i = 0; i < students.length; i += SEATS_PER_ROW)
    rows.push(students.slice(i, i + SEATS_PER_ROW));

  return (
    <div
      ref={ref}
      className="rounded-lg border border-border bg-surface-secondary/30 p-sm sm:p-md"
      style={{ perspective: reduceMotion ? undefined : 900 }}>
      <div className="mx-auto mb-md w-full  rounded-full bg-surface-secondary py-1 text-center text-xs font-medium text-muted-foreground">
        Front of classroom
      </div>
      <div className="flex flex-col items-center gap-sm">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex gap-sm sm:gap-md"
            style={{
              transform: reduceMotion
                ? undefined
                : `translateZ(${-rowIndex * 6}px) scale(${1 - rowIndex * 0.015})`,
            }}>
            {row.map((student) => {
              const status = statusFor(student.id);
              const tone = attendanceStatusTone[status];
              return (
                <motion.button
                  key={student.id}
                  type="button"
                  onClick={() => onToggle(student.id)}
                  initial={
                    !reduceMotion && inView ? { opacity: 0, y: 6 } : false
                  }
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.94, y: 2 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "surface-3d flex size-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border text-center outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-16",
                    "border-border bg-surface",
                    toneClasses[tone].ring,
                    status !== "not-marked" && "ring-2",
                  )}
                  aria-label={`${student.name}: ${status}`}>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-pill text-[10px] font-bold sm:size-7",
                      toneClasses[tone].soft,
                    )}>
                    {seatInitials(student.name)}
                  </span>
                  <span className="max-w-full truncate px-0.5 text-[9px] text-muted-foreground">
                    {firstToken(student.name)}
                  </span>
                </motion.button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
