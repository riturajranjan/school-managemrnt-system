"use client";

import { useState } from "react";
import type { TimetableSlot } from "@/lib/types/timetable";

const MAX_HISTORY = 30;

/**
 * Local undo/redo for one timetable-editing session, working entirely
 * against the caller's in-memory `slots` (the working draft copy the editor
 * page keeps before "Save draft" commits it) — never touches the store
 * directly, so undo/redo stay instant and don't create a flurry of
 * intermediate persisted states. Deliberately session-local: history resets
 * on navigation away, which is the expected behavior for this kind of editor.
 */
export function useTimetableHistory(slots: TimetableSlot[], onRestore: (slots: TimetableSlot[]) => void) {
  const [past, setPast] = useState<TimetableSlot[][]>([]);
  const [future, setFuture] = useState<TimetableSlot[][]>([]);

  function recordAndRun(nextSlots: TimetableSlot[]) {
    setPast((prev) => [...prev.slice(-MAX_HISTORY + 1), slots]);
    setFuture([]);
    onRestore(nextSlots);
  }

  function undo() {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [slots, ...prev].slice(0, MAX_HISTORY));
    onRestore(previous);
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, slots].slice(-MAX_HISTORY));
    onRestore(next);
  }

  function reset() {
    setPast([]);
    setFuture([]);
  }

  return { recordAndRun, undo, redo, reset, canUndo: past.length > 0, canRedo: future.length > 0 };
}
