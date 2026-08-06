"use client";

import { useState } from "react";
import { CheckCircle2, DoorOpen, Sparkles, Users } from "lucide-react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import type { Db } from "@/lib/data/store";
import {
  conflictReason,
  getAlternativePeriods,
  getAvailableRooms,
  getAvailableTeachers,
  getConflictSlotContexts,
  suggestResolution,
  type SuggestedResolution,
} from "@/lib/selectors/timetable-conflicts";
import { periodDefinitions, weekDays, type TimetableConflict } from "@/lib/types/timetable";
import { cn } from "@/lib/utils";

const typeLabels: Record<TimetableConflict["type"], string> = {
  "teacher-double-booking": "Teacher overlap",
  "room-double-booking": "Room conflict",
  "subject-period-limit": "Subject limit",
  "consecutive-period-limit": "Scheduling issue",
};

export function ConflictDrawer({
  conflict,
  db,
  canManage,
  onOpenChange,
  onApply,
  onDismiss,
}: {
  conflict: TimetableConflict | null;
  db: Db;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (resolution: SuggestedResolution) => void;
  onDismiss: (conflictId: string, reason: string) => void;
}) {
  const [ignoreReason, setIgnoreReason] = useState("");
  const [showIgnoreField, setShowIgnoreField] = useState(false);

  const contexts = conflict ? getConflictSlotContexts(db, conflict) : [];
  const reason = conflict ? conflictReason(conflict, contexts) : "";
  const period = conflict ? periodDefinitions.find((p) => p.index === conflict.periodIndex) : undefined;
  const resolution = conflict ? suggestResolution(db, conflict, weekDays) : ({ kind: "none" } as const);

  const primaryContext = contexts[0];
  const subjectId = primaryContext?.slot.subjectId;
  const subject = db.subjects.find((s) => s.id === subjectId);
  const availableTeachers = conflict?.type === "teacher-double-booking" ? getAvailableTeachers(db, conflict.day, conflict.periodIndex, subjectId).slice(0, 5) : [];
  const availableRooms = conflict?.type === "room-double-booking" ? getAvailableRooms(db, conflict.day, conflict.periodIndex, subject?.type === "practical" ? "lab" : "classroom").slice(0, 5) : [];
  const alternativePeriods = conflict && primaryContext ? getAlternativePeriods(db, primaryContext.timetable, primaryContext.slot, weekDays) : [];

  return (
    <DetailDrawer
      open={conflict !== null}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          setShowIgnoreField(false);
          setIgnoreReason("");
        }
      }}
      title={conflict ? typeLabels[conflict.type] : "Conflict"}
      description={conflict ? `${conflict.day} · ${period?.label ?? `Period ${conflict.periodIndex}`}` : ""}
    >
      {conflict && (
      <div className="flex flex-col gap-md">
        <Badge tone={conflict.severity === "error" ? "error" : "warning"} className="self-start">
          {conflict.severity === "error" ? "Needs attention" : "Worth reviewing"}
        </Badge>

        <div className="rounded-md border border-border bg-surface-secondary/40 p-sm text-sm text-foreground">{reason}</div>

        <div className="grid grid-cols-2 gap-sm text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Affected teacher{contexts.filter((c) => c.teacherName).length > 1 ? "s" : ""}</p>
            <p className="text-foreground">{[...new Set(contexts.map((c) => c.teacherName).filter(Boolean))].join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Affected section{contexts.length > 1 ? "s" : ""}</p>
            <p className="text-foreground">{contexts.map((c) => c.className).join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Day &amp; period</p>
            <p className="text-foreground">
              {conflict.day}, {period?.label} ({period?.startTime}–{period?.endTime})
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Room</p>
            <p className="text-foreground">{[...new Set(contexts.map((c) => c.roomName).filter(Boolean))].join(", ") || "—"}</p>
          </div>
        </div>

        {resolution.kind !== "none" && canManage && (
          <div className="rounded-md border border-info/30 bg-info/8 p-sm">
            <p className="mb-xs flex items-center gap-1 text-xs font-semibold text-info">
              <Sparkles className="size-3.5" /> Suggested resolution
            </p>
            <p className="mb-sm text-sm text-foreground">
              {resolution.kind === "move-room" && `Move this class to ${resolution.roomName}.`}
              {resolution.kind === "move-period" && `Move this class to ${resolution.label}, where the teacher and room are both free.`}
              {resolution.kind === "reassign-teacher" && `Reassign this period to ${resolution.teacherName}, who is free at this time.`}
            </p>
            <Button size="sm" onClick={() => onApply(resolution)}>
              <CheckCircle2 className="size-3.5" />
              Apply resolution
            </Button>
          </div>
        )}

        {conflict.type === "teacher-double-booking" && (
          <div>
            <p className="mb-xs text-xs font-medium text-foreground">Available teachers at this time</p>
            {availableTeachers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No teachers are free at this period.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {availableTeachers.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-md border border-border px-sm py-1.5 text-sm">
                    <span className="flex items-center gap-1 text-foreground">
                      <Users className="size-3.5 text-muted-foreground" /> {t.name}
                    </span>
                    {canManage && primaryContext && (
                      <Button size="sm" variant="ghost" onClick={() => onApply({ kind: "reassign-teacher", slotId: primaryContext.slot.id, timetableId: primaryContext.timetable.id, teacherId: t.id, teacherName: t.name })}>
                        Assign
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {conflict.type === "room-double-booking" && (
          <div>
            <p className="mb-xs text-xs font-medium text-foreground">Available rooms at this time</p>
            {availableRooms.length === 0 ? (
              <p className="text-xs text-muted-foreground">No rooms are free at this period.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {availableRooms.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-md border border-border px-sm py-1.5 text-sm">
                    <span className="flex items-center gap-1 text-foreground">
                      <DoorOpen className="size-3.5 text-muted-foreground" /> {r.name}
                    </span>
                    {canManage && primaryContext && (
                      <Button size="sm" variant="ghost" onClick={() => onApply({ kind: "move-room", slotId: primaryContext.slot.id, timetableId: primaryContext.timetable.id, roomId: r.id, roomName: r.name })}>
                        Assign
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {alternativePeriods.length > 0 && (
          <div>
            <p className="mb-xs text-xs font-medium text-foreground">Alternative periods for this class</p>
            <div className="flex flex-wrap gap-1">
              {alternativePeriods.map((alt) => (
                <button
                  key={`${alt.day}-${alt.periodIndex}`}
                  type="button"
                  disabled={!canManage || !primaryContext}
                  onClick={() => primaryContext && onApply({ kind: "move-period", slotId: primaryContext.slot.id, timetableId: primaryContext.timetable.id, day: alt.day, periodIndex: alt.periodIndex, label: alt.label })}
                  className={cn(
                    "rounded-pill border border-border px-sm py-1 text-xs font-medium text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    canManage && "hover:border-primary hover:text-primary",
                  )}
                >
                  {alt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {canManage && (
          <div className="border-t border-border pt-sm">
            {!showIgnoreField ? (
              <Button variant="ghost" size="sm" onClick={() => setShowIgnoreField(true)}>
                Ignore with reason
              </Button>
            ) : (
              <div className="flex flex-col gap-xs">
                <Label htmlFor="ignore-reason">Why is this okay to leave as-is?</Label>
                <Textarea id="ignore-reason" value={ignoreReason} onChange={(e) => setIgnoreReason(e.target.value)} rows={2} placeholder="e.g. Intentional co-teaching session" />
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  disabled={!ignoreReason.trim()}
                  onClick={() => {
                    onDismiss(conflict.id, ignoreReason.trim());
                    setShowIgnoreField(false);
                    setIgnoreReason("");
                  }}
                >
                  Confirm ignore
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </DetailDrawer>
  );
}
