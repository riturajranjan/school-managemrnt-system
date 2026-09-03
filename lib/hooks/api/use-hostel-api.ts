"use client";

// Real client hooks for Hostel Management (Phase 9Q). Reads/writes the live
// /api/hostel/* endpoints — no mock db.hostelBuildings/Rooms/Beds/Allocations.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  AssignHostelComplaintRequest,
  AssignHostelMaintenanceRequest,
  AssignHostelStaffRequest,
  AssignHostelStudentRequest,
  CompleteHostelMaintenanceRequest,
  CreateHostelComplaintRequest,
  CreateHostelLeaveRequest,
  CreateHostelMaintenanceRequest,
  CreateHostelRequest,
  CreateHostelRoomRequest,
  CreateHostelVisitorRequest,
  HostelAssignmentDto,
  HostelBedDto,
  HostelComplaintDto,
  HostelDashboardDto,
  HostelDto,
  HostelLeaveRequestDto,
  HostelMaintenanceRequestDto,
  HostelReportsDto,
  HostelRoomDto,
  HostelRollCallEntryDto,
  HostelStaffAssignmentDto,
  HostelVisitorDto,
  MarkHostelRollCallRequest,
  ResolveHostelComplaintRequest,
  ReviewHostelLeaveRequest,
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

// ── Leave (Phase C1) ─────────────────────────────────────────────────────

export function useHostelLeaveRequests(filters: { status?: string; studentId?: string; hostelId?: string; search?: string; page?: number; pageSize?: number } = {}) {
  return useApiList<HostelLeaveRequestDto>(`/api/hostel/leave${buildQuery(filters)}`);
}
export function useHostelLeaveRequest(id: string | undefined) {
  return useApiResource<HostelLeaveRequestDto>(id ? `/api/hostel/leave/${id}` : null);
}
export const createHostelLeaveRequestRequest = (body: CreateHostelLeaveRequest): Promise<ApiResult<HostelLeaveRequestDto>> => apiPost<HostelLeaveRequestDto>("/api/hostel/leave", body);
export const approveHostelLeaveRequestRequest = (id: string, body: ReviewHostelLeaveRequest = {}): Promise<ApiResult<HostelLeaveRequestDto>> => apiPost<HostelLeaveRequestDto>(`/api/hostel/leave/${id}/approve`, body);
export const rejectHostelLeaveRequestRequest = (id: string, body: ReviewHostelLeaveRequest = {}): Promise<ApiResult<HostelLeaveRequestDto>> => apiPost<HostelLeaveRequestDto>(`/api/hostel/leave/${id}/reject`, body);
export const cancelHostelLeaveRequestRequest = (id: string, body: ReviewHostelLeaveRequest = {}): Promise<ApiResult<HostelLeaveRequestDto>> => apiPost<HostelLeaveRequestDto>(`/api/hostel/leave/${id}/cancel`, body);

// ── Visitors (Phase C1) — resident/hostel visitors, separate from Front Desk ─

export function useHostelVisitors(filters: { status?: string; studentId?: string; hostelId?: string; search?: string; page?: number; pageSize?: number } = {}) {
  return useApiList<HostelVisitorDto>(`/api/hostel/visitors${buildQuery(filters)}`);
}
export function useHostelVisitor(id: string | undefined) {
  return useApiResource<HostelVisitorDto>(id ? `/api/hostel/visitors/${id}` : null);
}
export const createHostelVisitorRequest = (body: CreateHostelVisitorRequest): Promise<ApiResult<HostelVisitorDto>> => apiPost<HostelVisitorDto>("/api/hostel/visitors", body);
export const checkInHostelVisitorRequest = (id: string): Promise<ApiResult<HostelVisitorDto>> => apiPost<HostelVisitorDto>(`/api/hostel/visitors/${id}/check-in`, {});
export const checkOutHostelVisitorRequest = (id: string): Promise<ApiResult<HostelVisitorDto>> => apiPost<HostelVisitorDto>(`/api/hostel/visitors/${id}/check-out`, {});
export const cancelHostelVisitorRequest = (id: string): Promise<ApiResult<HostelVisitorDto>> => apiPost<HostelVisitorDto>(`/api/hostel/visitors/${id}/cancel`, {});

// ── Complaints (Phase C1) ────────────────────────────────────────────────

export function useHostelComplaints(filters: { status?: string; category?: string; priority?: string; studentId?: string; hostelId?: string; assignedStaffId?: string; search?: string; page?: number; pageSize?: number } = {}) {
  return useApiList<HostelComplaintDto>(`/api/hostel/complaints${buildQuery(filters)}`);
}
export function useHostelComplaint(id: string | undefined) {
  return useApiResource<HostelComplaintDto>(id ? `/api/hostel/complaints/${id}` : null);
}
export const createHostelComplaintRequest = (body: CreateHostelComplaintRequest): Promise<ApiResult<HostelComplaintDto>> => apiPost<HostelComplaintDto>("/api/hostel/complaints", body);
export const assignHostelComplaintRequest = (id: string, body: AssignHostelComplaintRequest): Promise<ApiResult<HostelComplaintDto>> => apiPost<HostelComplaintDto>(`/api/hostel/complaints/${id}/assign`, body);
export const startHostelComplaintRequest = (id: string): Promise<ApiResult<HostelComplaintDto>> => apiPost<HostelComplaintDto>(`/api/hostel/complaints/${id}/start`, {});
export const resolveHostelComplaintRequest = (id: string, body: ResolveHostelComplaintRequest): Promise<ApiResult<HostelComplaintDto>> => apiPost<HostelComplaintDto>(`/api/hostel/complaints/${id}/resolve`, body);
export const closeHostelComplaintRequest = (id: string): Promise<ApiResult<HostelComplaintDto>> => apiPost<HostelComplaintDto>(`/api/hostel/complaints/${id}/close`, {});

// ── Maintenance (Phase C1) — facility-level, not tied to a resident ────────

export function useHostelMaintenanceRequests(filters: { status?: string; priority?: string; hostelId?: string; assignedStaffId?: string; search?: string; page?: number; pageSize?: number } = {}) {
  return useApiList<HostelMaintenanceRequestDto>(`/api/hostel/maintenance${buildQuery(filters)}`);
}
export function useHostelMaintenanceRequest(id: string | undefined) {
  return useApiResource<HostelMaintenanceRequestDto>(id ? `/api/hostel/maintenance/${id}` : null);
}
export const createHostelMaintenanceRequestRequest = (body: CreateHostelMaintenanceRequest): Promise<ApiResult<HostelMaintenanceRequestDto>> => apiPost<HostelMaintenanceRequestDto>("/api/hostel/maintenance", body);
export const assignHostelMaintenanceRequest = (id: string, body: AssignHostelMaintenanceRequest): Promise<ApiResult<HostelMaintenanceRequestDto>> => apiPost<HostelMaintenanceRequestDto>(`/api/hostel/maintenance/${id}/assign`, body);
export const startHostelMaintenanceRequest = (id: string): Promise<ApiResult<HostelMaintenanceRequestDto>> => apiPost<HostelMaintenanceRequestDto>(`/api/hostel/maintenance/${id}/start`, {});
export const completeHostelMaintenanceRequest = (id: string, body: CompleteHostelMaintenanceRequest = {}): Promise<ApiResult<HostelMaintenanceRequestDto>> => apiPost<HostelMaintenanceRequestDto>(`/api/hostel/maintenance/${id}/complete`, body);
export const cancelHostelMaintenanceRequest = (id: string): Promise<ApiResult<HostelMaintenanceRequestDto>> => apiPost<HostelMaintenanceRequestDto>(`/api/hostel/maintenance/${id}/cancel`, {});

// ── Reports (Phase C1) — real DB aggregates only ────────────────────────

export function useHostelReports() {
  return useApiResource<HostelReportsDto>("/api/hostel/reports");
}

// ── Student 360 ──────────────────────────────────────────────────────────

export function useStudentHostelProfile(studentId: string | undefined) {
  return useApiResource<StudentHostelProfileDto>(studentId ? `/api/students/${studentId}/hostel` : null);
}
