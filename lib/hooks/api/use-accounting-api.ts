"use client";

// Real client hooks for Accounting / General Ledger (Phase 9G). Reads/writes
// the live /api/accounting/* endpoints — no mock chartOfAccounts/
// journalEntries/ledgerEntries store authority anywhere below.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  AccountingAccountDto,
  AccountingAccountStatusDto,
  AccountingAccountTypeDto,
  AccountingDashboardDto,
  AccountLedgerDto,
  BudgetDetailDto,
  BudgetListItemDto,
  CancelPurchaseOrderRequest,
  CreateAccountingAccountRequest,
  CreateBudgetRequest,
  CreateJournalEntryRequest,
  CreatePurchaseOrderRequest,
  CreateVendorRequest,
  IncomeExpenseReportDto,
  JournalEntryDetailDto,
  JournalEntryListItemDto,
  PurchaseOrderDetailDto,
  PurchaseOrderListItemDto,
  PurchaseOrderStatusDto,
  ReverseJournalEntryRequest,
  TrialBalanceDto,
  UpdateAccountingAccountRequest,
  UpdateVendorRequest,
  VendorDto,
  VendorStatusDto,
} from "@/lib/api/contracts";

// --- Chart of Accounts ---
export function useAccountingAccounts(params: { type?: AccountingAccountTypeDto; status?: AccountingAccountStatusDto; search?: string } = {}) {
  return useApiList<AccountingAccountDto>(`/api/accounting/accounts${buildQuery(params)}`);
}
export function useAccountingAccount(id: string | null) {
  return useApiResource<AccountingAccountDto>(id ? `/api/accounting/accounts/${id}` : null);
}
export const createAccountingAccountRequest = (body: CreateAccountingAccountRequest): Promise<ApiResult<AccountingAccountDto>> => apiPost<AccountingAccountDto>("/api/accounting/accounts", body);
export const updateAccountingAccountRequest = (id: string, body: UpdateAccountingAccountRequest): Promise<ApiResult<AccountingAccountDto>> => apiPatch<AccountingAccountDto>(`/api/accounting/accounts/${id}`, body);

// --- Journals ---
export function useJournalEntries(params: { sourceType?: string; status?: string; from?: string; to?: string; pageSize?: number } = {}) {
  return useApiList<JournalEntryListItemDto>(`/api/accounting/journals${buildQuery(params)}`);
}
export function useJournalEntry(id: string | null) {
  return useApiResource<JournalEntryDetailDto>(id ? `/api/accounting/journals/${id}` : null);
}
export const createAndPostJournalEntryRequest = (body: CreateJournalEntryRequest): Promise<ApiResult<JournalEntryDetailDto>> => apiPost<JournalEntryDetailDto>("/api/accounting/journals", body);
export const reverseJournalEntryRequest = (id: string, body: ReverseJournalEntryRequest): Promise<ApiResult<JournalEntryDetailDto>> => apiPost<JournalEntryDetailDto>(`/api/accounting/journals/${id}/reverse`, body);

// --- Ledger / Trial Balance / Reports ---
export function useAccountLedger(accountId: string | null, params: { from?: string; to?: string } = {}) {
  return useApiResource<AccountLedgerDto>(accountId ? `/api/accounting/ledger${buildQuery({ accountId, ...params })}` : null);
}
export function useTrialBalance(asOf?: string) {
  return useApiResource<TrialBalanceDto>(`/api/accounting/trial-balance${buildQuery({ asOf })}`);
}
export function useIncomeExpenseReport(params: { from?: string; to?: string } = {}) {
  return useApiResource<IncomeExpenseReportDto>(`/api/accounting/reports/income-expense${buildQuery(params)}`);
}
export function useAccountingDashboard() {
  return useApiResource<AccountingDashboardDto>("/api/accounting/dashboard");
}

// --- Vendors ---
export function useVendors(params: { status?: VendorStatusDto; search?: string; pageSize?: number } = {}) {
  return useApiList<VendorDto>(`/api/accounting/vendors${buildQuery(params)}`);
}
export function useVendor(id: string | null) {
  return useApiResource<VendorDto>(id ? `/api/accounting/vendors/${id}` : null);
}
export const createVendorRequest = (body: CreateVendorRequest): Promise<ApiResult<VendorDto>> => apiPost<VendorDto>("/api/accounting/vendors", body);
export const updateVendorRequest = (id: string, body: UpdateVendorRequest): Promise<ApiResult<VendorDto>> => apiPatch<VendorDto>(`/api/accounting/vendors/${id}`, body);

// --- Purchase Orders ---
export function usePurchaseOrders(params: { status?: PurchaseOrderStatusDto; vendorId?: string; pageSize?: number } = {}) {
  return useApiList<PurchaseOrderListItemDto>(`/api/accounting/purchase-orders${buildQuery(params)}`);
}
export function usePurchaseOrder(id: string | null) {
  return useApiResource<PurchaseOrderDetailDto>(id ? `/api/accounting/purchase-orders/${id}` : null);
}
export const createPurchaseOrderRequest = (body: CreatePurchaseOrderRequest): Promise<ApiResult<PurchaseOrderDetailDto>> => apiPost<PurchaseOrderDetailDto>("/api/accounting/purchase-orders", body);
export const approvePurchaseOrderRequest = (id: string): Promise<ApiResult<PurchaseOrderDetailDto>> => apiPost<PurchaseOrderDetailDto>(`/api/accounting/purchase-orders/${id}/approve`, {});
export const cancelPurchaseOrderRequest = (id: string, body: CancelPurchaseOrderRequest): Promise<ApiResult<PurchaseOrderDetailDto>> => apiPost<PurchaseOrderDetailDto>(`/api/accounting/purchase-orders/${id}/cancel`, body);

// --- Budgets ---
export function useBudgets(params: { status?: "draft" | "approved"; pageSize?: number } = {}) {
  return useApiList<BudgetListItemDto>(`/api/accounting/budgets${buildQuery(params)}`);
}
export function useBudget(id: string | null) {
  return useApiResource<BudgetDetailDto>(id ? `/api/accounting/budgets/${id}` : null);
}
export const createBudgetRequest = (body: CreateBudgetRequest): Promise<ApiResult<BudgetDetailDto>> => apiPost<BudgetDetailDto>("/api/accounting/budgets", body);
export const approveBudgetRequest = (id: string): Promise<ApiResult<BudgetDetailDto>> => apiPost<BudgetDetailDto>(`/api/accounting/budgets/${id}/approve`, {});
