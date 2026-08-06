"use client";

import { useState } from "react";
import { Coffee, Copy, Lock, Move, Trash2, Unlock } from "lucide-react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rooms, subjects, teachers } from "@/lib/data/seed/academics";
import { periodDefinitions, weekDays, type TimetableSlot, type WeekDay } from "@/lib/types/timetable";
import { opClearSlot, opCopyPeriod, opMovePeriod, opSetBreak, opToggleLock, opUpdateSlot } from "@/lib/utils/timetable-slot-ops";

const teachingPeriods = periodDefinitions.filter((p) => !p.isBreak);

export function SlotEditorDrawer({
  slot,
  slots,
  onOpenChange,
  onApply,
}: {
  slot: TimetableSlot | null;
  slots: TimetableSlot[];
  onOpenChange: (open: boolean) => void;
  onApply: (nextSlots: TimetableSlot[]) => void;
}) {
  const [moveDay, setMoveDay] = useState<WeekDay>("Monday");
  const [movePeriodIndex, setMovePeriodIndex] = useState(1);
  const [note, setNote] = useState(slot?.note ?? "");
  const [syncedSlotId, setSyncedSlotId] = useState(slot?.id);

  // Reset the local note draft whenever the drawer switches to a different slot (React's
  // documented render-time pattern for resetting state on prop change, instead of an effect).
  if (slot?.id !== syncedSlotId) {
    setSyncedSlotId(slot?.id);
    setNote(slot?.note ?? "");
  }

  return (
    <DetailDrawer
      open={slot !== null}
      onOpenChange={onOpenChange}
      title={slot ? `${slot.day} · Period ${slot.periodIndex}` : ""}
      description="Edit this period"
    >
      {slot && (
        <div className="flex flex-col gap-md">
          {slot.slotType === "break" ? (
            <div className="flex flex-col gap-sm rounded-md border border-dashed border-border p-sm text-center">
              <Coffee className="mx-auto size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">This period is marked as a break for this section.</p>
              <Button variant="outline" size="sm" onClick={() => onApply(opSetBreak(slots, slot.id, false))}>
                Remove break
              </Button>
            </div>
          ) : (
            <>
              <div>
                <Label>Subject</Label>
                <Select value={slot.subjectId ?? ""} onValueChange={(v) => onApply(opUpdateSlot(slots, slot.id, { subjectId: v }))}>
                  <SelectTrigger aria-label="Subject">
                    <SelectValue placeholder="No subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Teacher</Label>
                <Select value={slot.teacherId ?? ""} onValueChange={(v) => onApply(opUpdateSlot(slots, slot.id, { teacherId: v }))}>
                  <SelectTrigger aria-label="Teacher">
                    <SelectValue placeholder="No teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Room</Label>
                <Select value={slot.roomId ?? ""} onValueChange={(v) => onApply(opUpdateSlot(slots, slot.id, { roomId: v }))}>
                  <SelectTrigger aria-label="Room">
                    <SelectValue placeholder="No room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="slot-note">Note</Label>
                <Textarea
                  id="slot-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => onApply(opUpdateSlot(slots, slot.id, { note: note.trim() || undefined }))}
                  rows={2}
                  placeholder="e.g. Bring lab coats"
                />
              </div>

              <div className="rounded-md border border-border p-sm">
                <p className="mb-xs flex items-center gap-1 text-xs font-medium text-foreground">
                  <Move className="size-3.5" /> Move to a different period
                </p>
                <div className="flex flex-wrap items-center gap-xs">
                  <Select value={moveDay} onValueChange={(v) => setMoveDay(v as WeekDay)}>
                    <SelectTrigger className="w-32" aria-label="Target day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekDays.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(movePeriodIndex)} onValueChange={(v) => setMovePeriodIndex(Number(v))}>
                    <SelectTrigger className="w-28" aria-label="Target period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {teachingPeriods.map((p) => (
                        <SelectItem key={p.index} value={String(p.index)}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => onApply(opMovePeriod(slots, slot.id, moveDay, movePeriodIndex))}>
                    <Move className="size-3.5" />
                    Move
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const targetId = slots.find((s) => s.day === moveDay && s.periodIndex === movePeriodIndex)?.id;
                      if (targetId) onApply(opCopyPeriod(slots, slot.id, targetId));
                    }}
                  >
                    <Copy className="size-3.5" />
                    Copy instead
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-sm border-t border-border pt-sm">
                <Button variant="outline" size="sm" onClick={() => onApply(opToggleLock(slots, slot.id))}>
                  {slot.locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                  {slot.locked ? "Unlock" : "Lock"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => onApply(opSetBreak(slots, slot.id, true))}>
                  <Coffee className="size-3.5" />
                  Mark as break
                </Button>
                <Button variant="outline" size="sm" className="text-error" onClick={() => onApply(opClearSlot(slots, slot.id))}>
                  <Trash2 className="size-3.5" />
                  Clear
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </DetailDrawer>
  );
}
