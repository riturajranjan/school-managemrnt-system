"use client";

// Real client hooks for Timetable (Phase 7). Read/write the live /api/timetable
// + /api/academics/sections/[id]/timetable endpoints. No mock store, no local
// storage — PostgreSQL is the only authority.
import { apiDelete, apiPatch, apiPost, apiPut, type ApiResult } from "@/lib/api/client";
import { useApiResource } from "./use-api";
import type { SectionTimetableDto, TeacherTimetableDto, TimetableEntryDto, TimetablePeriodDto, Weekday } from "@/lib/api/contracts";

export function usePeriods() {
  return useApiResource<TimetablePeriodDto[]>("/api/timetable/periods");
}
export const reconcilePeriodsRequest = (periods: unknown[]): Promise<ApiResult<TimetablePeriodDto[]>> =>
  apiPut<TimetablePeriodDto[]>("/api/timetable/periods", { periods });

export function useSectionTimetable(sectionId: string | undefined) {
  return useApiResource<SectionTimetableDto>(sectionId ? `/api/academics/sections/${sectionId}/timetable` : null);
}
export function useTeacherTimetable(staffId: string | undefined) {
  return useApiResource<TeacherTimetableDto>(staffId ? `/api/timetable/teacher/${staffId}` : null);
}

export const createEntryRequest = (body: { sectionId: string; subjectId: string; staffId: string; periodId: string; weekday: Weekday }): Promise<ApiResult<TimetableEntryDto>> =>
  apiPost<TimetableEntryDto>("/api/timetable/entries", body);
export const updateEntryRequest = (entryId: string, body: { periodId?: string; weekday?: Weekday }): Promise<ApiResult<TimetableEntryDto>> =>
  apiPatch<TimetableEntryDto>(`/api/timetable/entries/${entryId}`, body);
export const deleteEntryRequest = (entryId: string): Promise<ApiResult<{ id: string }>> =>
  apiDelete<{ id: string }>(`/api/timetable/entries/${entryId}`);
