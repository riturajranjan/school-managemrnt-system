"use client";

// Real client hooks for Health / Infirmary Management (Phase 9R). Reads/
// writes the live /api/health/* endpoints — no mock db.healthVisits/Profiles.
// Named use-health-API (not use-health.ts, which is the unrelated real
// Super-Admin tenant-health hook) to avoid a naming collision.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  CreateHealthVisitRequest,
  HealthDashboardDto,
  HealthMedicationAdministrationDto,
  HealthMedicationListItemDto,
  HealthProfileDto,
  HealthReportsDto,
  HealthTreatmentRecordDto,
  HealthVisitDetailDto,
  HealthVisitDto,
  HealthVitalObservationDto,
  ReferHealthVisitRequest,
  RecordHealthMedicationRequest,
  RecordHealthTreatmentRequest,
  RecordHealthVitalsRequest,
  StudentHealthProfileDto,
  UpdateHealthVisitRequest,
  UpsertHealthProfileRequest,
} from "@/lib/api/contracts";

// ── Visits ───────────────────────────────────────────────────────────────

export function useHealthVisits(filters: { studentId?: string; staffId?: string; status?: string; page?: number; pageSize?: number } = {}) {
  return useApiList<HealthVisitDto>(`/api/health/visits${buildQuery(filters)}`);
}
export function useHealthVisit(visitId: string | undefined) {
  return useApiResource<HealthVisitDetailDto>(visitId ? `/api/health/visits/${visitId}` : null);
}
export const createHealthVisitRequest = (body: CreateHealthVisitRequest): Promise<ApiResult<HealthVisitDto>> => apiPost<HealthVisitDto>("/api/health/visits", body);
export const updateHealthVisitRequest = (id: string, body: UpdateHealthVisitRequest): Promise<ApiResult<HealthVisitDto>> => apiPatch<HealthVisitDto>(`/api/health/visits/${id}`, body);
export const closeHealthVisitRequest = (id: string): Promise<ApiResult<HealthVisitDto>> => apiPost<HealthVisitDto>(`/api/health/visits/${id}/close`, {});
export const referHealthVisitRequest = (id: string, body: ReferHealthVisitRequest): Promise<ApiResult<HealthVisitDto>> => apiPost<HealthVisitDto>(`/api/health/visits/${id}/refer`, body);

// ── Vitals / Treatment / Medication ──────────────────────────────────────

export const recordHealthVitalsRequest = (visitId: string, body: RecordHealthVitalsRequest): Promise<ApiResult<HealthVitalObservationDto>> =>
  apiPost<HealthVitalObservationDto>(`/api/health/visits/${visitId}/vitals`, body);
export const recordHealthTreatmentRequest = (visitId: string, body: RecordHealthTreatmentRequest): Promise<ApiResult<HealthTreatmentRecordDto>> =>
  apiPost<HealthTreatmentRecordDto>(`/api/health/visits/${visitId}/treatments`, body);
export const recordHealthMedicationRequest = (visitId: string, body: RecordHealthMedicationRequest): Promise<ApiResult<HealthMedicationAdministrationDto>> =>
  apiPost<HealthMedicationAdministrationDto>(`/api/health/visits/${visitId}/medications`, body);

// ── Profiles ─────────────────────────────────────────────────────────────

export function useStudentHealthProfileRecord(studentId: string | undefined) {
  return useApiResource<HealthProfileDto>(studentId ? `/api/health/students/${studentId}/profile` : null);
}
export const upsertStudentHealthProfileRequest = (studentId: string, body: UpsertHealthProfileRequest): Promise<ApiResult<HealthProfileDto>> =>
  apiPatch<HealthProfileDto>(`/api/health/students/${studentId}/profile`, body);

export function useStaffHealthProfileRecord(staffId: string | undefined) {
  return useApiResource<HealthProfileDto>(staffId ? `/api/health/staff/${staffId}/profile` : null);
}
export const upsertStaffHealthProfileRequest = (staffId: string, body: UpsertHealthProfileRequest): Promise<ApiResult<HealthProfileDto>> =>
  apiPatch<HealthProfileDto>(`/api/health/staff/${staffId}/profile`, body);

// ── Medications (Phase C2) — cross-visit administration log, read-only ────

export function useHealthMedications(filters: { studentId?: string; staffId?: string; search?: string; page?: number; pageSize?: number } = {}) {
  return useApiList<HealthMedicationListItemDto>(`/api/health/medications${buildQuery(filters)}`);
}
export function useHealthMedication(id: string | undefined) {
  return useApiResource<HealthMedicationListItemDto>(id ? `/api/health/medications/${id}` : null);
}

// ── Reports (Phase C2) — real DB aggregates only ────────────────────────

export function useHealthReports() {
  return useApiResource<HealthReportsDto>("/api/health/reports");
}

// ── Dashboard ────────────────────────────────────────────────────────────

export function useHealthDashboard() {
  return useApiResource<HealthDashboardDto>("/api/health/dashboard");
}

// ── Student 360 ──────────────────────────────────────────────────────────

export function useStudentHealthProfile(studentId: string | undefined) {
  return useApiResource<StudentHealthProfileDto>(studentId ? `/api/students/${studentId}/health` : null);
}
