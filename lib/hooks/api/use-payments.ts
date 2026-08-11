"use client";

// Real-data payment hooks (Super Admin SA-4E). Payments are real DB rows that
// settle invoices via /api/super-admin/payments — no mock store, no fake
// transaction IDs, no localStorage.
import { apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { PaymentDto } from "@/lib/api/contracts";

export type PaymentListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  school?: string;
  method?: string;
  status?: string;
  from?: string;
  to?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export function usePaymentList(query: PaymentListQuery) {
  const url = `/api/super-admin/payments${buildQuery({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    school: query.school,
    method: query.method && query.method !== "all" ? query.method : undefined,
    status: query.status && query.status !== "all" ? query.status : undefined,
    from: query.from,
    to: query.to,
    sort: query.sort,
    order: query.order,
  })}`;
  return useApiList<PaymentDto>(url);
}

export function usePayment(id: string | undefined) {
  return useApiResource<PaymentDto>(id ? `/api/super-admin/payments/${id}` : null);
}

export type RecordPaymentInput = {
  invoiceId: string;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  receivedAt?: string;
};

export const recordPaymentRequest = (input: RecordPaymentInput): Promise<ApiResult<PaymentDto>> =>
  apiPost<PaymentDto>("/api/super-admin/payments", input);

export const reversePaymentRequest = (id: string): Promise<ApiResult<PaymentDto>> =>
  apiPost<PaymentDto>(`/api/super-admin/payments/${id}/reverse`, {});
