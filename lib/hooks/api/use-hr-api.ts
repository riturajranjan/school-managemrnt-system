"use client";

// Real client hooks for HR Core master data (Phase 9P). Reads/writes the
// live /api/hr/* endpoints — no mock db.departments/db.designations/
// db.employees. Staff CRUD itself stays on use-staff-api.ts (unchanged).
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  AssignShiftRequest,
  AssignTrainingParticipantRequest,
  ContractDto,
  ContractStatusDto,
  CreateContractRequest,
  CreateDepartmentRequest,
  CreateDesignationRequest,
  CreateEmployeeOnboardingRequest,
  CreateHrPolicyRequest,
  CreateJobApplicantRequest,
  CreateJobOpeningRequest,
  CreatePerformanceReviewRequest,
  CreateShiftRequest,
  CreateTrainingProgramRequest,
  DepartmentDto,
  DesignationDto,
  EmployeeOnboardingDto,
  EmployeeOnboardingStatusDto,
  HrDashboardDto,
  HrPolicyDto,
  HrPolicyStatusDto,
  JobApplicantDto,
  JobApplicantStageDto,
  JobOpeningDto,
  JobOpeningStatusDto,
  PerformanceReviewDto,
  PerformanceReviewStatusDto,
  PerformanceReviewSummaryDto,
  ShiftAssignmentDto,
  ShiftDto,
  ShiftStatusDto,
  StaffDocumentDto,
  StaffDocumentStatusDto,
  StartOnboardingRequest,
  TrainingParticipantDto,
  TrainingParticipantStatusDto,
  TrainingProgramDto,
  TrainingProgramStatusDto,
  TrainingProgramSummaryDto,
  UpdateContractRequest,
  UpdateDepartmentRequest,
  UpdateDesignationRequest,
  UpdateEmployeeOnboardingRequest,
  UpdateHrPolicyRequest,
  UpdateJobApplicantRequest,
  UpdateJobOpeningRequest,
  UpdatePerformanceReviewRequest,
  UpdateShiftRequest,
  UpdateTrainingProgramRequest,
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

// ── Performance Reviews (Production migration, HR Sub-batch 3) ──────────

export function usePerformanceReviews(
  filters: { staffId?: string; reviewerId?: string; status?: PerformanceReviewStatusDto; search?: string; page?: number; pageSize?: number } = {},
) {
  return useApiList<PerformanceReviewDto>(`/api/hr/performance-reviews${buildQuery(filters)}`);
}
/** Whole-scope status/rating aggregates for the stat tiles — unaffected by the list's own search/filter/page. */
export function usePerformanceReviewsSummary() {
  return useApiResource<PerformanceReviewSummaryDto>("/api/hr/performance-reviews/summary");
}
export function usePerformanceReview(reviewId: string | undefined) {
  return useApiResource<PerformanceReviewDto>(reviewId ? `/api/hr/performance-reviews/${reviewId}` : null);
}
export const createPerformanceReviewRequest = (body: CreatePerformanceReviewRequest): Promise<ApiResult<PerformanceReviewDto>> =>
  apiPost<PerformanceReviewDto>("/api/hr/performance-reviews", body);
export const updatePerformanceReviewRequest = (id: string, body: UpdatePerformanceReviewRequest): Promise<ApiResult<PerformanceReviewDto>> =>
  apiPatch<PerformanceReviewDto>(`/api/hr/performance-reviews/${id}`, body);
export const setPerformanceReviewStatusRequest = (id: string, status: PerformanceReviewStatusDto): Promise<ApiResult<PerformanceReviewDto>> =>
  apiPost<PerformanceReviewDto>(`/api/hr/performance-reviews/${id}/status`, { status });

// ── Training (Production migration, HR Sub-batch 3) ──────────────────────

export function useTrainingPrograms(filters: { status?: TrainingProgramStatusDto; category?: string; search?: string; page?: number; pageSize?: number } = {}) {
  return useApiList<TrainingProgramDto>(`/api/hr/training-programs${buildQuery(filters)}`);
}
/** Whole-scope status aggregates for the stat tiles — unaffected by the list's own search/filter/page. */
export function useTrainingProgramsSummary() {
  return useApiResource<TrainingProgramSummaryDto>("/api/hr/training-programs/summary");
}
export function useTrainingProgram(programId: string | undefined) {
  return useApiResource<TrainingProgramDto>(programId ? `/api/hr/training-programs/${programId}` : null);
}
export const createTrainingProgramRequest = (body: CreateTrainingProgramRequest): Promise<ApiResult<TrainingProgramDto>> =>
  apiPost<TrainingProgramDto>("/api/hr/training-programs", body);
export const updateTrainingProgramRequest = (id: string, body: UpdateTrainingProgramRequest): Promise<ApiResult<TrainingProgramDto>> =>
  apiPatch<TrainingProgramDto>(`/api/hr/training-programs/${id}`, body);
export const setTrainingProgramStatusRequest = (id: string, status: TrainingProgramStatusDto): Promise<ApiResult<TrainingProgramDto>> =>
  apiPost<TrainingProgramDto>(`/api/hr/training-programs/${id}/status`, { status });

/** `data` is `null` (not `[]`) while `programId` is undefined — useApiList has
 * no way to skip a fetch, so this uses useApiResource<T[]> instead. */
export function useTrainingParticipants(programId: string | undefined) {
  return useApiResource<TrainingParticipantDto[]>(programId ? `/api/hr/training-programs/${programId}/participants` : null);
}
export const assignTrainingParticipantRequest = (programId: string, body: AssignTrainingParticipantRequest): Promise<ApiResult<TrainingParticipantDto>> =>
  apiPost<TrainingParticipantDto>(`/api/hr/training-programs/${programId}/participants`, body);
export const setTrainingParticipantStatusRequest = (
  participantId: string,
  body: { status: TrainingParticipantStatusDto; completedAt?: string; certificateIssued?: boolean },
): Promise<ApiResult<TrainingParticipantDto>> => apiPost<TrainingParticipantDto>(`/api/hr/training-participants/${participantId}/status`, body);

// ── Recruitment (Production migration, HR Sub-batch 4) ──────────────────

export function useJobOpenings(filters: { status?: JobOpeningStatusDto } = {}) {
  return useApiList<JobOpeningDto>(`/api/hr/job-openings${buildQuery(filters)}`);
}
export function useJobOpening(openingId: string | undefined) {
  return useApiResource<JobOpeningDto>(openingId ? `/api/hr/job-openings/${openingId}` : null);
}
export const createJobOpeningRequest = (body: CreateJobOpeningRequest): Promise<ApiResult<JobOpeningDto>> => apiPost<JobOpeningDto>("/api/hr/job-openings", body);
export const updateJobOpeningRequest = (id: string, body: UpdateJobOpeningRequest): Promise<ApiResult<JobOpeningDto>> => apiPatch<JobOpeningDto>(`/api/hr/job-openings/${id}`, body);
export const setJobOpeningStatusRequest = (id: string, status: JobOpeningStatusDto): Promise<ApiResult<JobOpeningDto>> =>
  apiPost<JobOpeningDto>(`/api/hr/job-openings/${id}/status`, { status });

export function useJobApplicants(filters: { jobOpeningId?: string; stage?: JobApplicantStageDto } = {}) {
  return useApiList<JobApplicantDto>(`/api/hr/job-applicants${buildQuery(filters)}`);
}
export const createJobApplicantRequest = (body: CreateJobApplicantRequest): Promise<ApiResult<JobApplicantDto>> => apiPost<JobApplicantDto>("/api/hr/job-applicants", body);
export const updateJobApplicantRequest = (id: string, body: UpdateJobApplicantRequest): Promise<ApiResult<JobApplicantDto>> => apiPatch<JobApplicantDto>(`/api/hr/job-applicants/${id}`, body);
export const setJobApplicantStageRequest = (id: string, stage: JobApplicantStageDto): Promise<ApiResult<JobApplicantDto>> =>
  apiPost<JobApplicantDto>(`/api/hr/job-applicants/${id}/stage`, { stage });
export const startOnboardingFromApplicantRequest = (id: string, body: StartOnboardingRequest): Promise<ApiResult<EmployeeOnboardingDto>> =>
  apiPost<EmployeeOnboardingDto>(`/api/hr/job-applicants/${id}/start-onboarding`, body);

// ── Employee Onboarding (Production migration, HR Sub-batch 4) ──────────

export function useEmployeeOnboardings(filters: { status?: EmployeeOnboardingStatusDto } = {}) {
  return useApiList<EmployeeOnboardingDto>(`/api/hr/onboarding${buildQuery(filters)}`);
}
export function useEmployeeOnboarding(onboardingId: string | undefined) {
  return useApiResource<EmployeeOnboardingDto>(onboardingId ? `/api/hr/onboarding/${onboardingId}` : null);
}
export const createEmployeeOnboardingRequest = (body: CreateEmployeeOnboardingRequest): Promise<ApiResult<EmployeeOnboardingDto>> =>
  apiPost<EmployeeOnboardingDto>("/api/hr/onboarding", body);
export const updateEmployeeOnboardingRequest = (id: string, body: UpdateEmployeeOnboardingRequest): Promise<ApiResult<EmployeeOnboardingDto>> =>
  apiPatch<EmployeeOnboardingDto>(`/api/hr/onboarding/${id}`, body);
export const setEmployeeOnboardingStatusRequest = (id: string, status: EmployeeOnboardingStatusDto): Promise<ApiResult<EmployeeOnboardingDto>> =>
  apiPost<EmployeeOnboardingDto>(`/api/hr/onboarding/${id}/status`, { status });
export const completeOnboardingTaskRequest = (taskId: string): Promise<ApiResult<EmployeeOnboardingDto>> =>
  apiPost<EmployeeOnboardingDto>(`/api/hr/onboarding-tasks/${taskId}/complete`, {});
export const reopenOnboardingTaskRequest = (taskId: string): Promise<ApiResult<EmployeeOnboardingDto>> =>
  apiPost<EmployeeOnboardingDto>(`/api/hr/onboarding-tasks/${taskId}/reopen`, {});

// ── HR Policies (Production migration, HR Sub-batch 4) ──────────────────

export function useHrPolicies(filters: { status?: HrPolicyStatusDto } = {}) {
  return useApiList<HrPolicyDto>(`/api/hr/policies${buildQuery(filters)}`);
}
export const createHrPolicyRequest = (body: CreateHrPolicyRequest): Promise<ApiResult<HrPolicyDto>> => apiPost<HrPolicyDto>("/api/hr/policies", body);
export const updateHrPolicyRequest = (id: string, body: UpdateHrPolicyRequest): Promise<ApiResult<HrPolicyDto>> => apiPatch<HrPolicyDto>(`/api/hr/policies/${id}`, body);
export const setHrPolicyStatusRequest = (id: string, status: HrPolicyStatusDto): Promise<ApiResult<HrPolicyDto>> =>
  apiPost<HrPolicyDto>(`/api/hr/policies/${id}/status`, { status });
export const acknowledgePolicyRequest = (id: string): Promise<ApiResult<{ acknowledged: boolean }>> =>
  apiPost<{ acknowledged: boolean }>(`/api/hr/policies/${id}/acknowledge`, {});

// ── Shifts (Production migration, HR Sub-batch 4) ────────────────────────

export function useShifts(filters: { status?: ShiftStatusDto } = {}) {
  return useApiList<ShiftDto>(`/api/hr/shifts${buildQuery(filters)}`);
}
export const createShiftRequest = (body: CreateShiftRequest): Promise<ApiResult<ShiftDto>> => apiPost<ShiftDto>("/api/hr/shifts", body);
export const updateShiftRequest = (id: string, body: UpdateShiftRequest): Promise<ApiResult<ShiftDto>> => apiPatch<ShiftDto>(`/api/hr/shifts/${id}`, body);
export const setShiftStatusRequest = (id: string, status: ShiftStatusDto): Promise<ApiResult<ShiftDto>> => apiPost<ShiftDto>(`/api/hr/shifts/${id}/status`, { status });

/** `data` is `null` while `shiftId` is undefined — see the training-participants note above. */
export function useShiftAssignments(shiftId: string | undefined) {
  return useApiResource<ShiftAssignmentDto[]>(shiftId ? `/api/hr/shifts/${shiftId}/assignments` : null);
}
export const assignShiftRequest = (shiftId: string, body: AssignShiftRequest): Promise<ApiResult<ShiftAssignmentDto>> =>
  apiPost<ShiftAssignmentDto>(`/api/hr/shifts/${shiftId}/assignments`, body);
