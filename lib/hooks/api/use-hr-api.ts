"use client";

// Real client hooks for HR Core master data (Phase 9P). Reads/writes the
// live /api/hr/* endpoints — no mock db.departments/db.designations/
// db.employees. Staff CRUD itself stays on use-staff-api.ts (unchanged).
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  CreateDepartmentRequest,
  CreateDesignationRequest,
  DepartmentDto,
  DesignationDto,
  HrDashboardDto,
  UpdateDepartmentRequest,
  UpdateDesignationRequest,
} from "@/lib/api/contracts";

// ── Departments ──────────────────────────────────────────────────────────

export function useDepartments(filters: { status?: string; search?: string } = {}) {
  return useApiList<DepartmentDto>(`/api/hr/departments${buildQuery(filters)}`);
}
export function useDepartment(departmentId: string | undefined) {
  return useApiResource<DepartmentDto>(departmentId ? `/api/hr/departments/${departmentId}` : null);
}
export const createDepartmentRequest = (body: CreateDepartmentRequest): Promise<ApiResult<DepartmentDto>> => apiPost<DepartmentDto>("/api/hr/departments", body);
export const updateDepartmentRequest = (id: string, body: UpdateDepartmentRequest): Promise<ApiResult<DepartmentDto>> => apiPatch<DepartmentDto>(`/api/hr/departments/${id}`, body);
export const setDepartmentStatusRequest = (id: string, status: "active" | "archived"): Promise<ApiResult<DepartmentDto>> => apiPost<DepartmentDto>(`/api/hr/departments/${id}/status`, { status });

// ── Designations ─────────────────────────────────────────────────────────

export function useDesignations(filters: { status?: string; departmentId?: string; search?: string } = {}) {
  return useApiList<DesignationDto>(`/api/hr/designations${buildQuery(filters)}`);
}
export function useDesignation(designationId: string | undefined) {
  return useApiResource<DesignationDto>(designationId ? `/api/hr/designations/${designationId}` : null);
}
export const createDesignationRequest = (body: CreateDesignationRequest): Promise<ApiResult<DesignationDto>> => apiPost<DesignationDto>("/api/hr/designations", body);
export const updateDesignationRequest = (id: string, body: UpdateDesignationRequest): Promise<ApiResult<DesignationDto>> => apiPatch<DesignationDto>(`/api/hr/designations/${id}`, body);
export const setDesignationStatusRequest = (id: string, status: "active" | "archived"): Promise<ApiResult<DesignationDto>> => apiPost<DesignationDto>(`/api/hr/designations/${id}/status`, { status });

// ── Dashboard ────────────────────────────────────────────────────────────

export function useHrDashboard() {
  return useApiResource<HrDashboardDto>("/api/hr/dashboard");
}
