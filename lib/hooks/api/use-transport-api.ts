"use client";

// Real client hooks for Transport Management (Phase 9M). Reads/writes the
// live /api/transport/* endpoints — no mock store, no fake GPS/telemetry.
import { apiPost, apiPut, apiPatch, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  AssignStaffTransportRequest,
  AssignStudentTransportRequest,
  BulkAssignResultDto,
  BulkAssignStudentTransportRequest,
  CreateTransportRouteRequest,
  CreateTransportStopRequest,
  CreateTransportTripRequest,
  CreateTransportVehicleRequest,
  CurrentTransportStaffDto,
  FlagStopUnsafeRequest,
  MarkBoardingRequest,
  MarkDropRequest,
  SetRouteAssignmentRequest,
  SetRouteStopsRequest,
  SetStopStatusRequest,
  SetTransportVehicleStatusRequest,
  StaffTransportAssignmentDto,
  StudentTransportAssignmentDto,
  StudentTransportProfileDto,
  TransportDashboardDto,
  TransportRouteAssignmentDto,
  TransportRouteListItemDto,
  TransportRouteStopDto,
  TransportStopDto,
  TransportTripDetailDto,
  TransportTripListItemDto,
  TransportVehicleDto,
  UpdateTransportRouteRequest,
  UpdateTransportVehicleRequest,
  WithdrawStudentTransportRequest,
} from "@/lib/api/contracts";

// ── Vehicles ─────────────────────────────────────────────────────────────

export function useTransportVehicles(filters: { status?: string; search?: string } = {}) {
  return useApiList<TransportVehicleDto>(`/api/transport/vehicles${buildQuery(filters)}`);
}
export function useTransportVehicle(vehicleId: string | undefined) {
  return useApiResource<TransportVehicleDto>(vehicleId ? `/api/transport/vehicles/${vehicleId}` : null);
}
export const createVehicleRequest = (body: CreateTransportVehicleRequest): Promise<ApiResult<TransportVehicleDto>> => apiPost<TransportVehicleDto>("/api/transport/vehicles", body);
export const updateVehicleRequest = (id: string, body: UpdateTransportVehicleRequest): Promise<ApiResult<TransportVehicleDto>> => apiPatch<TransportVehicleDto>(`/api/transport/vehicles/${id}`, body);
export const setVehicleStatusRequest = (id: string, body: SetTransportVehicleStatusRequest): Promise<ApiResult<TransportVehicleDto>> => apiPost<TransportVehicleDto>(`/api/transport/vehicles/${id}/status`, body);

// ── Routes ───────────────────────────────────────────────────────────────

export function useTransportRoutes(filters: { status?: string; search?: string } = {}) {
  return useApiList<TransportRouteListItemDto>(`/api/transport/routes${buildQuery(filters)}`);
}
export function useTransportRoute(routeId: string | undefined) {
  return useApiResource<TransportRouteListItemDto>(routeId ? `/api/transport/routes/${routeId}` : null);
}
export const createRouteRequest = (body: CreateTransportRouteRequest): Promise<ApiResult<TransportRouteListItemDto>> => apiPost<TransportRouteListItemDto>("/api/transport/routes", body);
export const updateRouteRequest = (id: string, body: UpdateTransportRouteRequest): Promise<ApiResult<TransportRouteListItemDto>> => apiPatch<TransportRouteListItemDto>(`/api/transport/routes/${id}`, body);

export function useRouteStops(routeId: string | undefined) {
  return useApiResource<TransportRouteStopDto[]>(routeId ? `/api/transport/routes/${routeId}/stops` : null);
}
export const setRouteStopsRequest = (routeId: string, body: SetRouteStopsRequest): Promise<ApiResult<TransportRouteStopDto[]>> => apiPut<TransportRouteStopDto[]>(`/api/transport/routes/${routeId}/stops`, body);

export function useRouteAssignment(routeId: string | undefined) {
  return useApiResource<TransportRouteAssignmentDto | null>(routeId ? `/api/transport/routes/${routeId}/assignment` : null);
}
export function useRouteAssignmentHistory(routeId: string) {
  return useApiList<TransportRouteAssignmentDto>(`/api/transport/routes/${routeId}/assignment/history`);
}
export const setRouteAssignmentRequest = (routeId: string, body: SetRouteAssignmentRequest): Promise<ApiResult<TransportRouteAssignmentDto>> => apiPost<TransportRouteAssignmentDto>(`/api/transport/routes/${routeId}/assignment`, body);

export function useCurrentTransportStaff(role: "driver" | "attendant") {
  return useApiList<CurrentTransportStaffDto>(`/api/transport/staff-on-duty${buildQuery({ role })}`);
}

// ── Stops ────────────────────────────────────────────────────────────────

export function useTransportStops(filters: { status?: string; search?: string } = {}) {
  return useApiList<TransportStopDto>(`/api/transport/stops${buildQuery(filters)}`);
}
export const createStopRequest = (body: CreateTransportStopRequest): Promise<ApiResult<TransportStopDto>> => apiPost<TransportStopDto>("/api/transport/stops", body);
export const flagStopUnsafeRequest = (id: string, body: FlagStopUnsafeRequest): Promise<ApiResult<TransportStopDto>> => apiPost<TransportStopDto>(`/api/transport/stops/${id}/flag-unsafe`, body);
export const setStopStatusRequest = (id: string, body: SetStopStatusRequest): Promise<ApiResult<TransportStopDto>> => apiPost<TransportStopDto>(`/api/transport/stops/${id}/status`, body);

// ── Assignments ──────────────────────────────────────────────────────────

export function useStudentTransportAssignments(filters: { status?: string; routeId?: string } = {}) {
  return useApiList<StudentTransportAssignmentDto>(`/api/transport/assignments/students${buildQuery(filters)}`);
}
export const assignStudentTransportRequest = (body: AssignStudentTransportRequest): Promise<ApiResult<StudentTransportAssignmentDto>> => apiPost<StudentTransportAssignmentDto>("/api/transport/assignments/students", body);
export const bulkAssignStudentTransportRequest = (body: BulkAssignStudentTransportRequest): Promise<ApiResult<BulkAssignResultDto>> => apiPost<BulkAssignResultDto>("/api/transport/assignments/students/bulk", body);
export const withdrawStudentTransportRequest = (id: string, body: WithdrawStudentTransportRequest = {}): Promise<ApiResult<StudentTransportAssignmentDto>> => apiPost<StudentTransportAssignmentDto>(`/api/transport/assignments/students/${id}/withdraw`, body);

export function useStaffTransportAssignments(filters: { status?: string } = {}) {
  return useApiList<StaffTransportAssignmentDto>(`/api/transport/assignments/staff${buildQuery(filters)}`);
}
export const assignStaffTransportRequest = (body: AssignStaffTransportRequest): Promise<ApiResult<StaffTransportAssignmentDto>> => apiPost<StaffTransportAssignmentDto>("/api/transport/assignments/staff", body);
export const withdrawStaffTransportRequest = (id: string): Promise<ApiResult<StaffTransportAssignmentDto>> => apiPost<StaffTransportAssignmentDto>(`/api/transport/assignments/staff/${id}/withdraw`, {});

// ── Trips ────────────────────────────────────────────────────────────────

export function useTransportTrips(filters: { status?: string; routeId?: string; vehicleId?: string; date?: string } = {}) {
  return useApiList<TransportTripListItemDto>(`/api/transport/trips${buildQuery(filters)}`);
}
export function useMyTransportTrips() {
  return useApiList<TransportTripListItemDto>("/api/transport/trips/mine");
}
export function useTransportTrip(tripId: string | undefined) {
  return useApiResource<TransportTripDetailDto>(tripId ? `/api/transport/trips/${tripId}` : null);
}
export const createTripRequest = (body: CreateTransportTripRequest): Promise<ApiResult<TransportTripDetailDto>> => apiPost<TransportTripDetailDto>("/api/transport/trips", body);
export const startTripRequest = (id: string): Promise<ApiResult<TransportTripDetailDto>> => apiPost<TransportTripDetailDto>(`/api/transport/trips/${id}/start`, {});
export const completeTripRequest = (id: string): Promise<ApiResult<TransportTripDetailDto>> => apiPost<TransportTripDetailDto>(`/api/transport/trips/${id}/complete`, {});
export const cancelTripRequest = (id: string): Promise<ApiResult<TransportTripDetailDto>> => apiPost<TransportTripDetailDto>(`/api/transport/trips/${id}/cancel`, {});
export const markTripStopRequest = (tripId: string, tripStopId: string, status: "arrived" | "departed"): Promise<ApiResult<TransportTripDetailDto>> => apiPost<TransportTripDetailDto>(`/api/transport/trips/${tripId}/stops/${tripStopId}`, { status });
export const markBoardingRequest = (tripId: string, tripStudentId: string, body: MarkBoardingRequest): Promise<ApiResult<TransportTripDetailDto>> => apiPost<TransportTripDetailDto>(`/api/transport/trips/${tripId}/students/${tripStudentId}/board`, body);
export const markDropRequest = (tripId: string, tripStudentId: string, body: MarkDropRequest): Promise<ApiResult<TransportTripDetailDto>> => apiPost<TransportTripDetailDto>(`/api/transport/trips/${tripId}/students/${tripStudentId}/drop`, body);

// ── Dashboard / Student 360 ──────────────────────────────────────────────

export function useTransportDashboard() {
  return useApiResource<TransportDashboardDto>("/api/transport/dashboard");
}
export function useStudentTransportProfile(studentId: string | undefined) {
  return useApiResource<StudentTransportProfileDto>(studentId ? `/api/students/${studentId}/transport` : null);
}
