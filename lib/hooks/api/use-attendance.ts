"use client";

// Real Attendance client hooks (Phase 5). Read/write the live /api/attendance/*
// endpoints — no mock store, no localStorage. Keyed on real Section + Enrollment.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  AttendanceHistoryItemDto,
  AttendanceSessionViewDto,
  SectionDto,
  StudentAttendanceSummaryDto,
} from "@/lib/api/contracts";

/** Real sections available for attendance selection (Academics Foundation). */
export function useAttendanceSections() {
  return useApiList<SectionDto>("/api/attendance/sections");
}

/** Read-only session view (roster + records) for a section + date. */
export function useAttendanceSession(sectionId: string | undefined, date: string | undefined) {
  const url = sectionId && date ? `/api/attendance/session?sectionId=${encodeURIComponent(sectionId)}&date=${encodeURIComponent(date)}` : null;
  return useApiResource<AttendanceSessionViewDto>(url);
}

export const createAttendanceSessionRequest = (sectionId: string, date: string): Promise<ApiResult<AttendanceSessionViewDto>> =>
  apiPost<AttendanceSessionViewDto>("/api/attendance/sessions", { sectionId, date });

export const saveAttendanceRecordsRequest = (
  sessionId: string,
  records: { studentId: string; status: string; remarks?: string | null }[],
): Promise<ApiResult<AttendanceSessionViewDto>> => apiPatch<AttendanceSessionViewDto>(`/api/attendance/sessions/${sessionId}/records`, { records });

export const submitAttendanceSessionRequest = (sessionId: string): Promise<ApiResult<AttendanceSessionViewDto>> =>
  apiPost<AttendanceSessionViewDto>(`/api/attendance/sessions/${sessionId}/submit`, {});

export const lockAttendanceSessionRequest = (sessionId: string): Promise<ApiResult<AttendanceSessionViewDto>> =>
  apiPost<AttendanceSessionViewDto>(`/api/attendance/sessions/${sessionId}/lock`, {});

/** Paginated attendance history (register list) with server-side filters. */
export function useAttendanceHistory(query: { page?: number; pageSize?: number; classId?: string; sectionId?: string; status?: string; dateFrom?: string; dateTo?: string } = {}) {
  return useApiList<AttendanceHistoryItemDto>(`/api/attendance${buildQuery({ page: query.page, pageSize: query.pageSize, classId: query.classId, sectionId: query.sectionId, status: query.status, dateFrom: query.dateFrom, dateTo: query.dateTo })}`);
}

/** A student's real attendance summary + recent records (Student 360). */
export function useStudentAttendance(studentId: string | undefined) {
  return useApiResource<StudentAttendanceSummaryDto>(studentId ? `/api/students/${studentId}/attendance` : null);
}
