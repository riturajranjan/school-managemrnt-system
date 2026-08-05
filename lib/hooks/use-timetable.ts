"use client";

import { useMemo } from "react";
import { detectConflicts } from "@/lib/services/timetable-service";
import { useSisStore } from "./use-store";

export function useTimetables() {
  const db = useSisStore();
  return db.timetables;
}

export function useSectionTimetable(sectionId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.timetables.find((t) => t.sectionId === sectionId), [db.timetables, sectionId]);
}

export function useTeacherTimetable(teacherId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => {
    if (!teacherId) return [];
    return db.timetables.flatMap((t) => t.slots.filter((s) => s.teacherId === teacherId).map((s) => ({ slot: s, timetable: t })));
  }, [db.timetables, teacherId]);
}

export function useTimetableConflicts() {
  const db = useSisStore();
  return useMemo(() => detectConflicts(db), [db]);
}
