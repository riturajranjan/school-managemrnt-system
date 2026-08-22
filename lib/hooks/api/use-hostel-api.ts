"use client";

// Real client hooks for Hostel Management (Phase 9Q). Reads/writes the live
// /api/hostel/* endpoints — no mock db.hostelBuildings/Rooms/Beds/Allocations.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  AssignHostelStaffRequest,
  AssignHostelStudentRequest,
  CreateHostelRequest,
  CreateHostelRoomRequest,
  HostelAssignmentDto,
  HostelBedDto,
  HostelDashboardDto,
  HostelDto,
  HostelRoomDto,
  HostelRollCallEntryDto,
  HostelStaffAssignmentDto,
  MarkHostelRollCallRequest,
  SetHostelBedStatusRequest,
  StudentHostelProfileDto,
  TransferHostelAssignmentRequest,
  UpdateHostelRequest,
  UpdateHostelRoomRequest,
} from "@/lib/api/contracts";

// ── Hostels ──────────────────────────────────────────────────────────────

export function useHostels(filters: { status?: string } = {}) {
  return useApiList<HostelDto>(`/api/hostel/hostels${buildQuery(filters)}`);
}
export function useHostel(hostelId: string | undefined) {
  return useApiResource<HostelDto>(hostelId ? `/api/hostel/hostels/${hostelId}` : null);
}
export const createHostelRequest = (body: CreateHostelRequest): Promise<ApiResult<HostelDto>> => apiPost<HostelDto>("/api/hostel/hostels", body);
export const updateHostelRequest = (id: string, body: UpdateHostelRequest): Promise<ApiResult<HostelDto>> => apiPatch<HostelDto>(`/api/hostel/hostels/${id}`, body);

// ── Rooms / Beds ─────────────────────────────────────────────────────────

export function useHostelRooms(filters: { hostelId?: string; status?: string } = {}) {
  return useApiList<HostelRoomDto>(`/api/hostel/rooms${buildQuery(filters)}`);
}
export function useHostelRoom(roomId: string | undefined) {
  return useApiResource<HostelRoomDto>(roomId ? `/api/hostel/rooms/${roomId}` : null);
}
export const createHostelRoomRequest = (body: CreateHostelRoomRequest): Promise<ApiResult<HostelRoomDto>> => apiPost<HostelRoomDto>("/api/hostel/rooms", body);
export const updateHostelRoomRequest = (id: string, body: UpdateHostelRoomRequest): Promise<ApiResult<HostelRoomDto>> => apiPatch<HostelRoomDto>(`/api/hostel/rooms/${id}`, body);

export function useHostelBeds(filters: { roomId?: string; hostelId?: string; status?: string; search?: string } = {}) {
  return useApiList<HostelBedDto>(`/api/hostel/beds${buildQuery(filters)}`);
}
export const setHostelBedStatusRequest = (id: string, body: SetHostelBedStatusRequest): Promise<ApiResult<HostelBedDto>> => apiPost<HostelBedDto>(`/api/hostel/beds/${id}/status`, body);

// ── Assignments (allocate / transfer / vacate) ──────────────────────────

export function useHostelAssignments(filters: { hostelId?: string; roomId?: string; studentId?: string; status?: string } = {}) {
  return useApiList<HostelAssignmentDto>(`/api/hostel/assignments${buildQuery(filters)}`);
}
export const assignHostelStudentRequest = (body: AssignHostelStudentRequest): Promise<ApiResult<HostelAssignmentDto>> => apiPost<HostelAssignmentDto>("/api/hostel/assignments", body);
export const transferHostelAssignmentRequest = (id: string, body: TransferHostelAssignmentRequest): Promise<ApiResult<HostelAssignmentDto>> => apiPost<HostelAssignmentDto>(`/api/hostel/assignments/${id}/transfer`, body);
export const vacateHostelAssignmentRequest = (id: string): Promise<ApiResult<HostelAssignmentDto>> => apiPost<HostelAssignmentDto>(`/api/hostel/assignments/${id}/vacate`, {});

// ── Staff (warden) assignments ───────────────────────────────────────────

export function useHostelStaffAssignments(filters: { hostelId?: string; status?: string } = {}) {
  return useApiList<HostelStaffAssignmentDto>(`/api/hostel/staff-assignments${buildQuery(filters)}`);
}
export const assignHostelStaffRequest = (body: AssignHostelStaffRequest): Promise<ApiResult<HostelStaffAssignmentDto>> => apiPost<HostelStaffAssignmentDto>("/api/hostel/staff-assignments", body);
export const endHostelStaffAssignmentRequest = (id: string): Promise<ApiResult<HostelStaffAssignmentDto>> => apiPost<HostelStaffAssignmentDto>(`/api/hostel/staff-assignments/${id}/end`, {});

// ── Roll call ────────────────────────────────────────────────────────────

export function useHostelRollCall(date: string, hostelId?: string) {
  return useApiList<HostelRollCallEntryDto>(`/api/hostel/roll-call${buildQuery({ date, hostelId })}`);
}
export function useHostelRollCallHistory(studentId: string) {
  return useApiList<{ date: string; status: string }>(`/api/hostel/roll-call${buildQuery({ studentId })}`);
}
export const markHostelRollCallRequest = (body: MarkHostelRollCallRequest): Promise<ApiResult<{ studentId: string; date: string; status: string }>> => apiPost("/api/hostel/roll-call", body);

// ── Dashboard ────────────────────────────────────────────────────────────

export function useHostelDashboard() {
  return useApiResource<HostelDashboardDto>("/api/hostel/dashboard");
}

// ── Student 360 ──────────────────────────────────────────────────────────

export function useStudentHostelProfile(studentId: string | undefined) {
  return useApiResource<StudentHostelProfileDto>(studentId ? `/api/students/${studentId}/hostel` : null);
}
