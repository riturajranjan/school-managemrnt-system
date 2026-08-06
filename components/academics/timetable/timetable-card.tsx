"use client";

import { AlertTriangle, FlaskConical, Lock, Plus, Repeat, Coffee } from "lucide-react";
import { forwardRef, type KeyboardEvent } from "react";
import type { Subject } from "@/lib/types/academics";
import type { TimetableSlot } from "@/lib/types/timetable";
import { cn } from "@/lib/utils";

export type TimetableCardDensity = "compact" | "comfortable";

export type TimetableCardProps = {
  slot: TimetableSlot;
  subject?: Subject;
  teacherName?: string;
  roomName?: string;
  isLab?: boolean;
  isSubstitute?: boolean;
  hasConflict?: boolean;
  conflictLabel?: string;
  isSelectedConflict?: boolean;
  isDimmed?: boolean;
  isCurrent?: boolean;
  editable?: boolean;
  density?: TimetableCardDensity;
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
};

/**
 * One scheduled (or free, or break) grid cell. A plain CSS hover — lift +
 * a 1deg tilt gated behind `(hover: hover)` so touch devices never get a
 * "stuck" hover state, and `motion-reduce:` strips both for
 * prefers-reduced-motion. Conflicts render as a thin left rail + a small
 * top-right icon, never a full border, so a page full of them stays calm;
 * the one exception is `isSelectedConflict`, which gets the full ring
 * because it's the single thing the user is actively looking at.
 */
export const TimetableCard = forwardRef<HTMLButtonElement, TimetableCardProps>(function TimetableCard(
  { slot, subject, teacherName, roomName, isLab, isSubstitute, hasConflict, conflictLabel, isSelectedConflict, isDimmed, isCurrent, editable, density = "comfortable", onClick, onKeyDown },
  ref,
) {
  const isBreakSlot = slot.slotType === "break";
  const isEmpty = !subject && !isBreakSlot;
  const compact = density === "compact";

  if (isBreakSlot) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onKeyDown={onKeyDown}
        disabled={!editable}
        aria-label={`${slot.day}, period ${slot.periodIndex}: break period${editable ? ", activate to edit" : ""}`}
        className={cn(
          "flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border/70 bg-surface-secondary/30 text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "min-h-11" : "min-h-14",
          editable && "hover:bg-surface-secondary/60",
        )}
      >
        <Coffee className="size-3 shrink-0" aria-hidden="true" />
        <span className="text-[10px] font-medium">Break</span>
      </button>
    );
  }

  if (isEmpty) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onKeyDown={onKeyDown}
        disabled={!editable}
        className={cn(
          "group/free relative flex w-full items-center justify-center rounded-md border border-transparent text-muted-foreground/60 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "min-h-11" : "min-h-14",
          editable && "hover:border-border hover:bg-surface-secondary/40 hover:text-muted-foreground",
        )}
        aria-label={editable ? `${slot.day}, period ${slot.periodIndex}: free period, activate to add a class` : `${slot.day}, period ${slot.periodIndex}: free period`}
      >
        <span className={cn("text-[10px]", editable && "[@media(hover:hover)]:group-hover/free:hidden")}>Free</span>
        {editable && (
          <span className="hidden size-5 items-center justify-center rounded-pill bg-primary text-primary-foreground [@media(hover:hover)]:group-hover/free:flex">
            <Plus className="size-3" aria-hidden="true" />
          </span>
        )}
      </button>
    );
  }

  const tintBg = subject ? `${subject.color}17` : undefined;
  const tintBorder = subject ? `${subject.color}33` : undefined;
  const label = [
    `${slot.day}, period ${slot.periodIndex}`,
    subject?.name,
    teacherName && `taught by ${teacherName}`,
    roomName && `in ${roomName}`,
    slot.locked && "locked",
    isSubstitute && "substitute teacher",
    isLab && "practical session",
    hasConflict && `conflict: ${conflictLabel ?? "scheduling issue"}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-label={label}
      className={cn(
        "surface-3d relative flex w-full flex-col items-start overflow-hidden rounded-md border text-left outline-none transition-[transform,box-shadow,opacity] duration-150 ease-out",
        "focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "min-h-11 gap-0 px-1.5 py-1" : "min-h-14 gap-0.5 px-2 py-1.5",
        isDimmed ? "opacity-35 saturate-50" : "opacity-100",
        !isDimmed && "[@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:rotate-[1deg] [@media(hover:hover)]:hover:shadow-floating",
        "motion-reduce:transform-none motion-reduce:transition-none",
        isSelectedConflict ? "border-error ring-2 ring-error ring-offset-1 ring-offset-background" : "border-transparent [@media(hover:hover)]:hover:border-border",
      )}
      style={{ backgroundColor: tintBg, borderColor: isSelectedConflict ? undefined : tintBorder }}
    >
      {hasConflict && !isSelectedConflict && (
        <span className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-error" aria-hidden="true" />
      )}

      <span className="absolute right-1 top-1 flex items-center gap-0.5">
        {isLab && (
          <span title="Lab / practical">
            <FlaskConical className="size-2.5 text-muted-foreground" aria-hidden="true" />
          </span>
        )}
        {isSubstitute && (
          <span title="Substitute teacher">
            <Repeat className="size-2.5 text-info" aria-hidden="true" />
          </span>
        )}
        {slot.locked && (
          <span title="Locked">
            <Lock className="size-2.5 text-muted-foreground" aria-hidden="true" />
          </span>
        )}
        {hasConflict && (
          <span title={conflictLabel ?? "Conflict"}>
            <AlertTriangle className={cn("size-2.5", isSelectedConflict ? "text-error" : "text-error/80")} aria-hidden="true" />
          </span>
        )}
      </span>

      <span
        className={cn("truncate font-semibold leading-tight", compact ? "max-w-[85%] text-[11px]" : "max-w-[80%] text-xs")}
        style={{ color: subject?.color }}
      >
        {subject?.name ?? subject?.shortName}
      </span>
      {teacherName && <span className="truncate text-[10px] leading-tight text-muted-foreground">{teacherName}</span>}
      {roomName && !compact && <span className="truncate text-[10px] leading-tight text-muted-foreground">{roomName}</span>}
      {conflictLabel && !compact && (
        <span className="mt-0.5 truncate rounded-sm bg-error/12 px-1 text-[9px] font-medium text-error">{conflictLabel}</span>
      )}

      {isCurrent && <span className="absolute inset-x-1 bottom-0.5 h-[2px] rounded-full bg-primary" aria-hidden="true" />}
    </button>
  );
});
