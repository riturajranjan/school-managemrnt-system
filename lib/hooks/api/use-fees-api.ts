"use client";

// Real client hooks for Fees & Collections (Phase 9F). Reads/writes the live
// /api/fees/* endpoints — no mock db.feeStructures/studentFeeItems/receipts/
// discounts/scholarships/reminders authority anywhere below.
import { apiGet, apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  ApplyFeeAdjustmentRequest,
  AssignFeeStructureRequest,
  AssignFeeStructureResultDto,
  CreateFeeCategoryRequest,
  CreateFeeRefundRequest,
  CreateFeeStructureRequest,
  DuesSummaryDto,
  FeeAdjustmentDto,
  FeeAdjustmentReportDto,
  FeeCategoryDto,
  FeeCollectionReportDto,
  FeeDashboardDto,
  FeeOutstandingReportDto,
  FeePaymentDto,
  FeeReconciliationReportDto,
  FeeRefundDto,
  FeeRefundListItemDto,
  FeeRefundReportDto,
  FeeReminderCandidateDto,
  FeeStructureDetailDto,
  FeeStructureListItemDto,
  FeeStructureStatusDto,
  RecordFeePaymentRequest,
  ReconcilePaymentRequest,
  StudentDuesRowDto,
  StudentFeeLedgerDto,
  UpdateFeeCategoryRequest,
  UpdateFeeStructureRequest,
} from "@/lib/api/contracts";

// --- Categories ---
export function useFeeCategories(includeArchived = false) {
  return useApiList<FeeCategoryDto>(`/api/fees/categories${buildQuery({ includeArchived: includeArchived ? "true" : undefined })}`);
}
export const createFeeCategoryRequest = (body: CreateFeeCategoryRequest): Promise<ApiResult<FeeCategoryDto>> => apiPost<FeeCategoryDto>("/api/fees/categories", body);
export const updateFeeCategoryRequest = (id: string, body: UpdateFeeCategoryRequest): Promise<ApiResult<FeeCategoryDto>> => apiPatch<FeeCategoryDto>(`/api/fees/categories/${id}`, body);

// --- Structures ---
export function useFeeStructures(status?: FeeStructureStatusDto) {
  return useApiList<FeeStructureListItemDto>(`/api/fees/structures${buildQuery({ status })}`);
}
export function useFeeStructure(id: string | null) {
  return useApiResource<FeeStructureDetailDto>(id ? `/api/fees/structures/${id}` : null);
}
export const createFeeStructureRequest = (body: CreateFeeStructureRequest): Promise<ApiResult<FeeStructureDetailDto>> => apiPost<FeeStructureDetailDto>("/api/fees/structures", body);
export const updateFeeStructureRequest = (id: string, body: UpdateFeeStructureRequest): Promise<ApiResult<FeeStructureDetailDto>> => apiPatch<FeeStructureDetailDto>(`/api/fees/structures/${id}`, body);
export const setFeeStructureStatusRequest = (id: string, status: FeeStructureStatusDto): Promise<ApiResult<FeeStructureDetailDto>> => apiPost<FeeStructureDetailDto>(`/api/fees/structures/${id}/status`, { status });

// --- Assignment ---
export const assignFeeStructureRequest = (body: AssignFeeStructureRequest): Promise<ApiResult<AssignFeeStructureResultDto>> => apiPost<AssignFeeStructureResultDto>("/api/fees/assignments", body);

// --- Adjustments (discount / scholarship / late fee) ---
export const applyFeeAdjustmentRequest = (body: ApplyFeeAdjustmentRequest): Promise<ApiResult<FeeAdjustmentDto>> => apiPost<FeeAdjustmentDto>("/api/fees/adjustments", body);

// --- Payments / receipts ---
export function useFeePayments(params: { studentId?: string; method?: string; reconciliationStatus?: string; from?: string; to?: string; pageSize?: number } = {}) {
  return useApiList<FeePaymentDto>(`/api/fees/payments${buildQuery(params)}`);
}
export function useFeePayment(id: string | null) {
  return useApiResource<FeePaymentDto>(id ? `/api/fees/payments/${id}` : null);
}
export const recordFeePaymentRequest = (body: RecordFeePaymentRequest): Promise<ApiResult<FeePaymentDto>> => apiPost<FeePaymentDto>("/api/fees/payments", body);
export const reconcilePaymentRequest = (id: string, body: ReconcilePaymentRequest): Promise<ApiResult<FeePaymentDto>> => apiPost<FeePaymentDto>(`/api/fees/payments/${id}/reconcile`, body);

// --- Refunds ---
export const listFeeRefundsRequest = (paymentId: string): Promise<ApiResult<FeeRefundDto[]>> => apiGet<FeeRefundDto[]>(`/api/fees/payments/${paymentId}/refunds`);
export const createFeeRefundRequest = (paymentId: string, body: CreateFeeRefundRequest): Promise<ApiResult<FeeRefundDto>> => apiPost<FeeRefundDto>(`/api/fees/payments/${paymentId}/refunds`, body);
export function useAllFeeRefunds() {
  return useApiList<FeeRefundListItemDto>("/api/fees/refunds");
}

// --- Dues / ledger ---
export function useStudentDues(params: { classId?: string; sectionId?: string; search?: string } = {}) {
  return useApiResource<StudentDuesRowDto[]>(`/api/fees/dues${buildQuery(params)}`);
}
export function useDuesSummary() {
  return useApiResource<DuesSummaryDto>("/api/fees/dues/summary");
}
export function useStudentFeeLedger(studentId: string | null) {
  return useApiResource<StudentFeeLedgerDto>(studentId ? `/api/fees/students/${studentId}/ledger` : null);
}

// --- Reminders (honest preview only — see the service doc comment) ---
export function useFeeReminderCandidates() {
  return useApiResource<FeeReminderCandidateDto[]>("/api/fees/reminders");
}

// --- Reports / dashboard ---
export function useFeeCollectionReport(params: { from?: string; to?: string } = {}) {
  return useApiResource<FeeCollectionReportDto>(`/api/fees/reports/collection${buildQuery(params)}`);
}
export function useFeeOutstandingReport() {
  return useApiResource<FeeOutstandingReportDto>("/api/fees/reports/outstanding");
}
export function useFeeAdjustmentReport(kind: "discount" | "scholarship" | "late_fee") {
  return useApiResource<FeeAdjustmentReportDto>(`/api/fees/reports/adjustments${buildQuery({ kind })}`);
}
export function useFeeRefundReport() {
  return useApiResource<FeeRefundReportDto>("/api/fees/reports/refunds");
}
export function useFeeReconciliationReport() {
  return useApiResource<FeeReconciliationReportDto>("/api/fees/reports/reconciliation");
}
export function useFeeDashboard() {
  return useApiResource<FeeDashboardDto>("/api/fees/dashboard");
}
