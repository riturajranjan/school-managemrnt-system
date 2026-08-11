"use client";

// Real-data support hooks (Super Admin SA-4I). Platform support tickets are real
// DB rows via /api/super-admin/support — no mock store, no fake delays.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { SupportAgentDto, SupportSummaryDto, SupportTicketDetailDto, SupportTicketDto } from "@/lib/api/contracts";

export type TicketListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  assignment?: string;
  escalated?: boolean;
  sort?: string;
  order?: "asc" | "desc";
};

export function useTicketList(query: TicketListQuery) {
  const url = `/api/super-admin/support/tickets${buildQuery({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    status: query.status && query.status !== "all" ? query.status : undefined,
    priority: query.priority && query.priority !== "all" ? query.priority : undefined,
    category: query.category,
    assignment: query.assignment,
    escalated: query.escalated ? "true" : undefined,
    sort: query.sort,
    order: query.order,
  })}`;
  return useApiList<SupportTicketDto>(url);
}

export function useTicket(id: string | undefined) {
  return useApiResource<SupportTicketDetailDto>(id ? `/api/super-admin/support/tickets/${id}` : null);
}

export function useSupportSummary() {
  return useApiResource<SupportSummaryDto>("/api/super-admin/support/summary");
}

export function useSupportAgents() {
  return useApiList<SupportAgentDto>("/api/super-admin/support/agents");
}

export const createTicketRequest = (body: unknown): Promise<ApiResult<SupportTicketDto>> =>
  apiPost<SupportTicketDto>("/api/super-admin/support/tickets", body);

export const updateTicketRequest = (id: string, body: unknown): Promise<ApiResult<SupportTicketDto>> =>
  apiPatch<SupportTicketDto>(`/api/super-admin/support/tickets/${id}`, body);

export const setTicketStatusRequest = (id: string, status: string): Promise<ApiResult<SupportTicketDto>> =>
  apiPost<SupportTicketDto>(`/api/super-admin/support/tickets/${id}/status`, { status });

export const assignTicketRequest = (id: string, assignedToUserId: string | null): Promise<ApiResult<SupportTicketDto>> =>
  apiPost<SupportTicketDto>(`/api/super-admin/support/tickets/${id}/assign`, { assignedToUserId });

export const addTicketMessageRequest = (id: string, body: string, internal: boolean): Promise<ApiResult<SupportTicketDetailDto>> =>
  apiPost<SupportTicketDetailDto>(`/api/super-admin/support/tickets/${id}/messages`, { body, internal });
