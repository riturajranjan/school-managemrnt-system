"use client";

// Real client hooks for Staff Attendance (Phase 9E.1). Reads the live
// /api/staff-attendance/* endpoints — a staff member with no record for a
// date is "not-marked", never synthesized as absent client-side either.
import { apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiResource } from "./use-api";
import type {
  MarkStaffAttendanceRequest,
  StaffAttendanceHistoryEntryDto,
  StaffAttendancePercentDto,
  StaffAttendanceRosterEntryDto,
  StaffAttendanceSummaryDto,
} from "@/lib/api/contracts";

export function useStaffAttendanceRoster(date: string) {
  return useApiResource<StaffAttendanceRosterEntryDto[]>(date ? `/api/staff-attendance${buildQuery({ date })}` : null);
}

export function useStaffAttendanceSummary(date: string) {
  return useApiResource<StaffAttendanceSummaryDto>(date ? `/api/staff-attendance/summary${buildQuery({ date })}` : null);
}

export function useStaffAttendanceDetail(staffId: string | null, from: string, to: string) {
  return useApiResource<{ history: StaffAttendanceHistoryEntryDto[]; percent: StaffAttendancePercentDto }>(
    staffId ? `/api/staff-attendance/staff/${staffId}${buildQuery({ from, to })}` : null,
  );
}

export const markStaffAttendanceRequest = (body: MarkStaffAttendanceRequest): Promise<ApiResult<{ success: boolean }>> => apiPost<{ success: boolean }>("/api/staff-attendance", body);
