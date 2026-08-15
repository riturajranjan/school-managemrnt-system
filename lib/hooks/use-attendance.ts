"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";

export function useAttendanceSessions(sectionId?: string) {
  const db = useSisStore();
  return useMemo(
    () => (sectionId ? db.attendanceSessions.filter((s) => s.sectionId === sectionId) : db.attendanceSessions),
    [db.attendanceSessions, sectionId],
  );
}
