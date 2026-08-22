"use client";

// Real client hooks for Activities / Student Life (Phase 9U). Reads/writes
// the live /api/activities/* endpoints — no mock db.clubs/schoolEvents/
// housePoints.
import { apiDelete, apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  ActivityDashboardDto,
  ActivityDto,
  ActivityEventDto,
  ActivityEventParticipantDto,
  ActivityMembershipDto,
  ActivityStaffAssignmentDto,
  AssignActivityStaffRequest,
  CreateActivityEventRequest,
  CreateActivityRequest,
  CreateStudentAchievementRequest,
  JoinActivityRequest,
  RegisterActivityParticipantRequest,
  StudentActivityProfileDto,
  StudentAchievementDto,
  UpdateActivityEventRequest,
  UpdateActivityParticipantRequest,
  UpdateActivityRequest,
} from "@/lib/api/contracts";

// ── Activities ───────────────────────────────────────────────────────────

export function useActivities(filters: { type?: string; status?: string; search?: string } = {}) {
  return useApiList<ActivityDto>(`/api/activities${buildQuery(filters)}`);
}
export function useActivity(activityId: string | undefined) {
  return useApiResource<ActivityDto>(activityId ? `/api/activities/${activityId}` : null);
}
export const createActivityRequest = (body: CreateActivityRequest): Promise<ApiResult<ActivityDto>> => apiPost<ActivityDto>("/api/activities", body);
export const updateActivityRequest = (id: string, body: UpdateActivityRequest): Promise<ApiResult<ActivityDto>> => apiPatch<ActivityDto>(`/api/activities/${id}`, body);

// ── Staff assignments ────────────────────────────────────────────────────

export function useActivityStaff(activityId: string) {
  return useApiList<ActivityStaffAssignmentDto>(`/api/activities/${activityId}/staff`);
}
export const assignActivityStaffRequest = (activityId: string, body: AssignActivityStaffRequest): Promise<ApiResult<ActivityStaffAssignmentDto>> =>
  apiPost<ActivityStaffAssignmentDto>(`/api/activities/${activityId}/staff`, body);
export const endActivityStaffRequest = (activityId: string, assignmentId: string): Promise<ApiResult<ActivityStaffAssignmentDto>> =>
  apiDelete<ActivityStaffAssignmentDto>(`/api/activities/${activityId}/staff/${assignmentId}`);

// ── Memberships ──────────────────────────────────────────────────────────

export function useActivityMembers(activityId: string, filters: { status?: string } = {}) {
  return useApiList<ActivityMembershipDto>(`/api/activities/${activityId}/members${buildQuery(filters)}`);
}
export const joinActivityRequest = (activityId: string, body: JoinActivityRequest): Promise<ApiResult<ActivityMembershipDto>> =>
  apiPost<ActivityMembershipDto>(`/api/activities/${activityId}/members`, body);
export const leaveActivityRequest = (activityId: string, membershipId: string): Promise<ApiResult<ActivityMembershipDto>> =>
  apiDelete<ActivityMembershipDto>(`/api/activities/${activityId}/members/${membershipId}`);

// ── Events ───────────────────────────────────────────────────────────────

export function useActivityEvents(filters: { activityId?: string; status?: string; upcoming?: boolean; dateFrom?: string; dateTo?: string } = {}) {
  const { upcoming, ...rest } = filters;
  return useApiList<ActivityEventDto>(`/api/activities/events${buildQuery({ ...rest, upcoming: upcoming === undefined ? undefined : String(upcoming) })}`);
}
export function useActivityEvent(eventId: string | undefined) {
  return useApiResource<ActivityEventDto>(eventId ? `/api/activities/events/${eventId}` : null);
}
export const createActivityEventRequest = (body: CreateActivityEventRequest): Promise<ApiResult<ActivityEventDto>> => {
  const { activityId, ...rest } = body;
  return apiPost<ActivityEventDto>(`/api/activities/${activityId}/events`, rest);
};
export const updateActivityEventRequest = (eventId: string, body: UpdateActivityEventRequest): Promise<ApiResult<ActivityEventDto>> =>
  apiPatch<ActivityEventDto>(`/api/activities/events/${eventId}`, body);
export const publishActivityEventRequest = (eventId: string): Promise<ApiResult<ActivityEventDto>> => apiPost<ActivityEventDto>(`/api/activities/events/${eventId}/publish`, {});
export const completeActivityEventRequest = (eventId: string): Promise<ApiResult<ActivityEventDto>> => apiPost<ActivityEventDto>(`/api/activities/events/${eventId}/complete`, {});
export const cancelActivityEventRequest = (eventId: string): Promise<ApiResult<ActivityEventDto>> => apiPost<ActivityEventDto>(`/api/activities/events/${eventId}/cancel`, {});

// ── Participants ─────────────────────────────────────────────────────────

export function useActivityEventParticipants(eventId: string) {
  return useApiList<ActivityEventParticipantDto>(`/api/activities/events/${eventId}/participants`);
}
export const registerActivityParticipantRequest = (eventId: string, body: RegisterActivityParticipantRequest): Promise<ApiResult<ActivityEventParticipantDto>> =>
  apiPost<ActivityEventParticipantDto>(`/api/activities/events/${eventId}/participants`, body);
export const updateActivityParticipantRequest = (eventId: string, participantId: string, body: UpdateActivityParticipantRequest): Promise<ApiResult<ActivityEventParticipantDto>> =>
  apiPatch<ActivityEventParticipantDto>(`/api/activities/events/${eventId}/participants/${participantId}`, body);

// ── Achievements ─────────────────────────────────────────────────────────

export function useStudentAchievements(studentId?: string) {
  return useApiList<StudentAchievementDto>(`/api/activities/achievements${buildQuery({ studentId })}`);
}
export const createStudentAchievementRequest = (body: CreateStudentAchievementRequest): Promise<ApiResult<StudentAchievementDto>> =>
  apiPost<StudentAchievementDto>("/api/activities/achievements", body);

// ── Dashboard ────────────────────────────────────────────────────────────

export function useActivityDashboard() {
  return useApiResource<ActivityDashboardDto>("/api/activities/dashboard");
}

// ── Student 360 ──────────────────────────────────────────────────────────

export function useStudentActivityProfile(studentId: string | undefined) {
  return useApiResource<StudentActivityProfileDto>(studentId ? `/api/students/${studentId}/activities` : null);
}
