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
  CreateAccountingAccountRequest,
  CreateJournalEntryRequest,
  IncomeExpenseReportDto,
  JournalEntryDetailDto,
  JournalEntryListItemDto,
  ReverseJournalEntryRequest,
  TrialBalanceDto,
  UpdateAccountingAccountRequest,
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
