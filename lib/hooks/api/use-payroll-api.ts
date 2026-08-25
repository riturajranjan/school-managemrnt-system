"use client";

// Real client hooks for Payroll (Phase 9H). Reads/writes the live
// /api/payroll/* endpoints — no mock payrollRuns/salaryStructures/payslips/
// employeeLoans/employeeAdvances store authority anywhere below.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  AddManualPayrollAdjustmentRequest,
  ApproveStaffFinancialAdvanceRequest,
  CreatePayrollRunRequest,
  CreateSalaryStructureRequest,
  CreateStaffFinancialAdvanceRequest,
  CreateStaffSalaryAssignmentRequest,
  DisburseStaffFinancialAdvanceRequest,
  PayrollDashboardDto,
  PayrollEarningsDeductionsReportDto,
  PayrollPaymentDto,
  PayrollRunDetailDto,
  PayrollRunListItemDto,
  PayrollRunStatusDto,
  PayslipDto,
  RecordPayrollPaymentRequest,
  RecordStaffFinancialAdvanceRepaymentRequest,
  RejectStaffFinancialAdvanceRequest,
  SalaryComponentDto,
  SalaryComponentStatusDto,
  SalaryStructureDetailDto,
  SalaryStructureListItemDto,
  SalaryStructureStatusDto,
  SetSalaryStructureStatusRequest,
  StaffFinancialAdvanceDetailDto,
  StaffFinancialAdvanceListItemDto,
  StaffFinancialAdvanceStatusDto,
  StaffSalaryAssignmentDto,
  UpdateSalaryComponentRequest,
  UpdateSalaryStructureRequest,
  UpdateStaffFinancialAdvanceRequest,
} from "@/lib/api/contracts";

// --- Salary Components ---
export function useSalaryComponents(params: { status?: SalaryComponentStatusDto } = {}) {
  return useApiList<SalaryComponentDto>(`/api/payroll/components${buildQuery(params)}`);
}
export const createSalaryComponentRequest = (body: Record<string, unknown>): Promise<ApiResult<SalaryComponentDto>> => apiPost<SalaryComponentDto>("/api/payroll/components", body);
export const updateSalaryComponentRequest = (id: string, body: UpdateSalaryComponentRequest): Promise<ApiResult<SalaryComponentDto>> => apiPatch<SalaryComponentDto>(`/api/payroll/components/${id}`, body);

// --- Salary Structures ---
export function useSalaryStructures(params: { status?: SalaryStructureStatusDto } = {}) {
  return useApiList<SalaryStructureListItemDto>(`/api/payroll/structures${buildQuery(params)}`);
}
export function useSalaryStructure(id: string | null) {
  return useApiResource<SalaryStructureDetailDto>(id ? `/api/payroll/structures/${id}` : null);
}
export const createSalaryStructureRequest = (body: CreateSalaryStructureRequest): Promise<ApiResult<SalaryStructureDetailDto>> => apiPost<SalaryStructureDetailDto>("/api/payroll/structures", body);
export const updateSalaryStructureRequest = (id: string, body: UpdateSalaryStructureRequest): Promise<ApiResult<SalaryStructureDetailDto>> => apiPatch<SalaryStructureDetailDto>(`/api/payroll/structures/${id}`, body);
export const setSalaryStructureStatusRequest = (id: string, body: SetSalaryStructureStatusRequest): Promise<ApiResult<SalaryStructureDetailDto>> => apiPost<SalaryStructureDetailDto>(`/api/payroll/structures/${id}/status`, body);

// --- Staff Salary Assignments ---
export function useStaffSalaryAssignments(staffId?: string) {
  return useApiList<StaffSalaryAssignmentDto>(`/api/payroll/assignments${buildQuery({ staffId })}`);
}
export const createStaffSalaryAssignmentRequest = (body: CreateStaffSalaryAssignmentRequest): Promise<ApiResult<StaffSalaryAssignmentDto>> => apiPost<StaffSalaryAssignmentDto>("/api/payroll/assignments", body);

// --- Payroll Runs ---
export function usePayrollRuns(params: { status?: PayrollRunStatusDto } = {}) {
  return useApiList<PayrollRunListItemDto>(`/api/payroll/runs${buildQuery(params)}`);
}
export function usePayrollRun(id: string | null) {
  return useApiResource<PayrollRunDetailDto>(id ? `/api/payroll/runs/${id}` : null);
}
export const createPayrollRunRequest = (body: CreatePayrollRunRequest): Promise<ApiResult<PayrollRunListItemDto>> => apiPost<PayrollRunListItemDto>("/api/payroll/runs", body);
export const calculatePayrollRunRequest = (id: string): Promise<ApiResult<PayrollRunDetailDto>> => apiPost<PayrollRunDetailDto>(`/api/payroll/runs/${id}/calculate`, {});
export const finalizePayrollRunRequest = (id: string): Promise<ApiResult<PayrollRunDetailDto>> => apiPost<PayrollRunDetailDto>(`/api/payroll/runs/${id}/finalize`, {});
export const payPayrollRunRequest = (id: string, body: RecordPayrollPaymentRequest): Promise<ApiResult<PayrollPaymentDto>> => apiPost<PayrollPaymentDto>(`/api/payroll/runs/${id}/pay`, body);
export const addManualPayrollAdjustmentRequest = (runId: string, itemId: string, body: AddManualPayrollAdjustmentRequest): Promise<ApiResult<PayrollRunDetailDto>> =>
  apiPost<PayrollRunDetailDto>(`/api/payroll/runs/${runId}/items/${itemId}/adjustments`, body);

// --- Payslips ---
export function usePayslips(period?: string) {
  return useApiList<{ id: string; period: string; employeeCode: string; staffName: string; netPay: number; runStatus: PayrollRunStatusDto }>(`/api/payroll/payslips${buildQuery({ period })}`);
}
export function usePayslip(id: string | null) {
  return useApiResource<PayslipDto>(id ? `/api/payroll/payslips/${id}` : null);
}

// --- Reports / Dashboard ---
export function usePayrollReport(year?: number) {
  return useApiResource<PayrollEarningsDeductionsReportDto>(`/api/payroll/reports${buildQuery({ year })}`);
}
export function usePayrollDashboard() {
  return useApiResource<PayrollDashboardDto>("/api/payroll/dashboard");
}

// --- Loans --- one shared real domain (StaffFinancialAdvance, type
// LOAN|ADVANCE) behind two route prefixes — see the schema doc comment.
export function useLoans(params: { status?: StaffFinancialAdvanceStatusDto; staffId?: string; pageSize?: number } = {}) {
  return useApiList<StaffFinancialAdvanceListItemDto>(`/api/payroll/loans${buildQuery(params)}`);
}
export function useLoan(id: string | null) {
  return useApiResource<StaffFinancialAdvanceDetailDto>(id ? `/api/payroll/loans/${id}` : null);
}
export const createLoanRequest = (body: CreateStaffFinancialAdvanceRequest): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPost<StaffFinancialAdvanceDetailDto>("/api/payroll/loans", body);
export const updateLoanRequest = (id: string, body: UpdateStaffFinancialAdvanceRequest): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPatch<StaffFinancialAdvanceDetailDto>(`/api/payroll/loans/${id}`, body);
export const approveLoanRequest = (id: string, body: ApproveStaffFinancialAdvanceRequest = {}): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPost<StaffFinancialAdvanceDetailDto>(`/api/payroll/loans/${id}/approve`, body);
export const rejectLoanRequest = (id: string, body: RejectStaffFinancialAdvanceRequest): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPost<StaffFinancialAdvanceDetailDto>(`/api/payroll/loans/${id}/reject`, body);
export const cancelLoanRequest = (id: string): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPost<StaffFinancialAdvanceDetailDto>(`/api/payroll/loans/${id}/cancel`, {});
export const disburseLoanRequest = (id: string, body: DisburseStaffFinancialAdvanceRequest): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPost<StaffFinancialAdvanceDetailDto>(`/api/payroll/loans/${id}/disburse`, body);
export const repayLoanRequest = (id: string, body: RecordStaffFinancialAdvanceRepaymentRequest): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPost<StaffFinancialAdvanceDetailDto>(`/api/payroll/loans/${id}/repay`, body);

// --- Advances ---
export function useAdvances(params: { status?: StaffFinancialAdvanceStatusDto; staffId?: string; pageSize?: number } = {}) {
  return useApiList<StaffFinancialAdvanceListItemDto>(`/api/payroll/advances${buildQuery(params)}`);
}
export function useAdvance(id: string | null) {
  return useApiResource<StaffFinancialAdvanceDetailDto>(id ? `/api/payroll/advances/${id}` : null);
}
export const createAdvanceRequest = (body: CreateStaffFinancialAdvanceRequest): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPost<StaffFinancialAdvanceDetailDto>("/api/payroll/advances", body);
export const updateAdvanceRequest = (id: string, body: UpdateStaffFinancialAdvanceRequest): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPatch<StaffFinancialAdvanceDetailDto>(`/api/payroll/advances/${id}`, body);
export const approveAdvanceRequest = (id: string, body: ApproveStaffFinancialAdvanceRequest = {}): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPost<StaffFinancialAdvanceDetailDto>(`/api/payroll/advances/${id}/approve`, body);
export const rejectAdvanceRequest = (id: string, body: RejectStaffFinancialAdvanceRequest): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPost<StaffFinancialAdvanceDetailDto>(`/api/payroll/advances/${id}/reject`, body);
export const cancelAdvanceRequest = (id: string): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPost<StaffFinancialAdvanceDetailDto>(`/api/payroll/advances/${id}/cancel`, {});
export const disburseAdvanceRequest = (id: string, body: DisburseStaffFinancialAdvanceRequest): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPost<StaffFinancialAdvanceDetailDto>(`/api/payroll/advances/${id}/disburse`, body);
export const repayAdvanceRequest = (id: string, body: RecordStaffFinancialAdvanceRepaymentRequest): Promise<ApiResult<StaffFinancialAdvanceDetailDto>> => apiPost<StaffFinancialAdvanceDetailDto>(`/api/payroll/advances/${id}/repay`, body);
