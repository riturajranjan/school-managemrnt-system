"use client";

// Real client hooks for Library Management (Phase 9N). Reads/writes the live
// /api/library/* endpoints — no mock store, no fake circulation/fines.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  CreateLibraryBookRequest,
  CreateLibraryCopyRequest,
  IssueLoanRequest,
  LibraryBookCopyDto,
  LibraryBookDto,
  LibraryDashboardDto,
  LibraryLoanDto,
  LibraryPolicyDto,
  ReturnLoanRequest,
  StudentLibraryProfileDto,
  UpdateLibraryBookRequest,
  UpdateLibraryCopyRequest,
  UpdateLibraryPolicyRequest,
} from "@/lib/api/contracts";

// ── Books ────────────────────────────────────────────────────────────────

export function useLibraryBooks(filters: { status?: string; search?: string } = {}) {
  return useApiList<LibraryBookDto>(`/api/library/books${buildQuery(filters)}`);
}
export function useLibraryBook(bookId: string | undefined) {
  return useApiResource<LibraryBookDto>(bookId ? `/api/library/books/${bookId}` : null);
}
export const createLibraryBookRequest = (body: CreateLibraryBookRequest): Promise<ApiResult<LibraryBookDto>> => apiPost<LibraryBookDto>("/api/library/books", body);
export const updateLibraryBookRequest = (id: string, body: UpdateLibraryBookRequest): Promise<ApiResult<LibraryBookDto>> => apiPatch<LibraryBookDto>(`/api/library/books/${id}`, body);

// ── Copies ───────────────────────────────────────────────────────────────

export function useLibraryCopies(filters: { bookId?: string; status?: string } = {}) {
  return useApiList<LibraryBookCopyDto>(`/api/library/copies${buildQuery(filters)}`);
}
export function useLibraryCopy(copyId: string | undefined) {
  return useApiResource<LibraryBookCopyDto>(copyId ? `/api/library/copies/${copyId}` : null);
}
export const createLibraryCopyRequest = (bookId: string, body: CreateLibraryCopyRequest): Promise<ApiResult<LibraryBookCopyDto>> => apiPost<LibraryBookCopyDto>(`/api/library/books/${bookId}/copies`, body);
export const updateLibraryCopyRequest = (id: string, body: UpdateLibraryCopyRequest): Promise<ApiResult<LibraryBookCopyDto>> => apiPatch<LibraryBookCopyDto>(`/api/library/copies/${id}`, body);
export const setCopyStatusRequest = (id: string, status: "available" | "damaged" | "archived"): Promise<ApiResult<LibraryBookCopyDto>> => apiPost<LibraryBookCopyDto>(`/api/library/copies/${id}/status`, { status });
export const markCopyLostRequest = (id: string): Promise<ApiResult<{ copyId: string }>> => apiPost<{ copyId: string }>(`/api/library/copies/${id}/lost`, {});

// ── Loans ────────────────────────────────────────────────────────────────

export function useLibraryLoans(filters: { status?: string; studentId?: string; staffId?: string; copyId?: string } = {}) {
  return useApiList<LibraryLoanDto>(`/api/library/loans${buildQuery(filters)}`);
}
export function useMyLibraryLoans() {
  return useApiList<LibraryLoanDto>("/api/library/loans/mine");
}
export function useLibraryLoan(loanId: string | undefined) {
  return useApiResource<LibraryLoanDto>(loanId ? `/api/library/loans/${loanId}` : null);
}
export const issueLoanRequest = (body: IssueLoanRequest): Promise<ApiResult<LibraryLoanDto>> => apiPost<LibraryLoanDto>("/api/library/loans", body);
export const returnLoanRequest = (id: string, body: ReturnLoanRequest = {}): Promise<ApiResult<LibraryLoanDto>> => apiPost<LibraryLoanDto>(`/api/library/loans/${id}/return`, body);
export const renewLoanRequest = (id: string): Promise<ApiResult<LibraryLoanDto>> => apiPost<LibraryLoanDto>(`/api/library/loans/${id}/renew`, {});

// ── Policy / Dashboard / Student 360 ─────────────────────────────────────

export function useLibraryPolicy() {
  return useApiResource<LibraryPolicyDto>("/api/library/policy");
}
export const updateLibraryPolicyRequest = (body: UpdateLibraryPolicyRequest): Promise<ApiResult<LibraryPolicyDto>> => apiPatch<LibraryPolicyDto>("/api/library/policy", body);

export function useLibraryDashboard() {
  return useApiResource<LibraryDashboardDto>("/api/library/dashboard");
}
export function useStudentLibraryProfile(studentId: string | undefined) {
  return useApiResource<StudentLibraryProfileDto>(studentId ? `/api/students/${studentId}/library` : null);
}
