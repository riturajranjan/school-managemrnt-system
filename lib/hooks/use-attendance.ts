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

export function useAttendanceRules() {
  const db = useSisStore();
  return db.attendanceRules;
}

export function useLeaveRequests(applicantType?: "student" | "staff") {
  const db = useSisStore();
  return useMemo(
    () => (applicantType ? db.leaveRequests.filter((r) => r.applicantType === applicantType) : db.leaveRequests),
    [db.leaveRequests, applicantType],
  );
}

export function useStaffAttendance() {
  const db = useSisStore();
  return db.staffAttendance;
}
