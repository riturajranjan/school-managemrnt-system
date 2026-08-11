"use client";

// Real-data billing + invoices hooks (Super Admin SA-4D). Read/write the live
// /api/super-admin/billing + /api/super-admin/invoices endpoints — invoices are
// real DB rows generated from Subscriptions. No mock store, no fake revenue.
import { apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { BillingSummaryDto, InvoiceDto } from "@/lib/api/contracts";

export function useBillingSummary() {
  return useApiResource<BillingSummaryDto>("/api/super-admin/billing/summary");
}

export type InvoiceListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  school?: string;
  from?: string;
  to?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export function useInvoiceList(query: InvoiceListQuery) {
  const url = `/api/super-admin/invoices${buildQuery({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    status: query.status && query.status !== "all" ? query.status : undefined,
    school: query.school,
    from: query.from,
    to: query.to,
    sort: query.sort,
    order: query.order,
  })}`;
  return useApiList<InvoiceDto>(url);
}

export function useInvoice(id: string | undefined) {
  return useApiResource<InvoiceDto>(id ? `/api/super-admin/invoices/${id}` : null);
}

export const generateInvoiceRequest = (subscriptionId: string): Promise<ApiResult<InvoiceDto>> =>
  apiPost<InvoiceDto>("/api/super-admin/invoices", { subscriptionId });

export const issueInvoiceRequest = (id: string): Promise<ApiResult<InvoiceDto>> =>
  apiPost<InvoiceDto>(`/api/super-admin/invoices/${id}/issue`, {});

export const voidInvoiceRequest = (id: string): Promise<ApiResult<InvoiceDto>> =>
  apiPost<InvoiceDto>(`/api/super-admin/invoices/${id}/void`, {});
// NOTE: invoice mark-paid was removed in SA-4E — settlement is a real Payment
// (see use-payments.recordPaymentRequest), the single financial mutation path.
