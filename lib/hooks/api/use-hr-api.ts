"use client";

// Real client hooks for HR Core master data (Phase 9P). Reads/writes the
// live /api/hr/* endpoints — no mock db.departments/db.designations/
// db.employees. Staff CRUD itself stays on use-staff-api.ts (unchanged).
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  ContractDto,
  ContractStatusDto,
  CreateContractRequest,
  CreateDepartmentRequest,
  CreateDesignationRequest,
  DepartmentDto,
  DesignationDto,
  HrDashboardDto,
  StaffDocumentDto,
  StaffDocumentStatusDto,
  UpdateContractRequest,
  UpdateDepartmentRequest,
  UpdateDesignationRequest,
  UploadStaffDocumentRequest,
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

// ── Contracts (Production migration, HR Sub-batch 2) ────────────────────

export function useContracts(filters: { staffId?: string; status?: ContractStatusDto } = {}) {
  return useApiList<ContractDto>(`/api/hr/contracts${buildQuery(filters)}`);
}
export function useContract(contractId: string | undefined) {
  return useApiResource<ContractDto>(contractId ? `/api/hr/contracts/${contractId}` : null);
}
export const createContractRequest = (body: CreateContractRequest): Promise<ApiResult<ContractDto>> => apiPost<ContractDto>("/api/hr/contracts", body);
export const updateContractRequest = (id: string, body: UpdateContractRequest): Promise<ApiResult<ContractDto>> => apiPatch<ContractDto>(`/api/hr/contracts/${id}`, body);
export const setContractStatusRequest = (id: string, status: ContractStatusDto): Promise<ApiResult<ContractDto>> =>
  apiPost<ContractDto>(`/api/hr/contracts/${id}/status`, { status });

// ── Staff Documents (Production migration, HR Sub-batch 2) — metadata only,
// no file upload. See lib/server/hr/documents.ts for the storage-gap note. ─

export function useStaffDocuments(filters: { staffId?: string; status?: StaffDocumentStatusDto } = {}) {
  return useApiList<StaffDocumentDto>(`/api/hr/documents${buildQuery(filters)}`);
}
export const uploadStaffDocumentRequest = (body: UploadStaffDocumentRequest): Promise<ApiResult<StaffDocumentDto>> =>
  apiPost<StaffDocumentDto>("/api/hr/documents", body);
export const setStaffDocumentStatusRequest = (id: string, status: "verified" | "rejected" | "archived"): Promise<ApiResult<StaffDocumentDto>> =>
  apiPost<StaffDocumentDto>(`/api/hr/documents/${id}/status`, { status });
