"use client";

// Real client hooks for the Academic Calendar (Phase 9D.1). Reads the live
// /api/calendar endpoint — a merged view of real manual CalendarEvent rows
// and events derived live from Exam schedule/Homework/Lesson Plan tables. No
// mock academic-events store, no client-side recurrence source of truth.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList } from "./use-api";
import type { CalendarEventDto, CreateCalendarEventRequest, UpdateCalendarEventRequest } from "@/lib/api/contracts";

export function useCalendarEvents(from: string, to: string) {
  return useApiList<CalendarEventDto>(`/api/calendar${buildQuery({ from, to })}`);
}

export const createCalendarEventRequest = (body: CreateCalendarEventRequest): Promise<ApiResult<{ id: string }>> => apiPost<{ id: string }>("/api/calendar", body);
export const updateCalendarEventRequest = (id: string, body: UpdateCalendarEventRequest): Promise<ApiResult<{ id: string }>> => apiPatch<{ id: string }>(`/api/calendar/${id}`, body);
export const cancelCalendarEventRequest = (id: string): Promise<ApiResult<{ id: string }>> => apiPost<{ id: string }>(`/api/calendar/${id}/cancel`, {});
