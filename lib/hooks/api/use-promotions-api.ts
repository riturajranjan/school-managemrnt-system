"use client";

// Real client hooks for Promotion / Academic-Year Transition (Phase 8E).
// Read/write the live /api/promotions/* endpoints — no mock store, no client-
// side eligibility calculation.
import { apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { PromotionCandidateDto, PromotionListItemDto, ProcessPromotionRequest } from "@/lib/api/contracts";

export function usePromotionCandidates(examId: string | undefined, targetAcademicSessionId: string | undefined, classId?: string, sectionId?: string) {
  const url = examId && targetAcademicSessionId ? `/api/promotions/candidates${buildQuery({ examId, targetAcademicSessionId, classId, sectionId })}` : null;
  return useApiResource<PromotionCandidateDto[]>(url);
}

export function usePromotions(filters: { fromAcademicSessionId?: string; toAcademicSessionId?: string; examId?: string; targetClassId?: string; decision?: string; search?: string; page?: number } = {}) {
  return useApiList<PromotionListItemDto>(`/api/promotions${buildQuery(filters)}`);
}

export function usePromotion(promotionId: string | undefined) {
  return useApiResource<PromotionListItemDto>(promotionId ? `/api/promotions/${promotionId}` : null);
}

export const processPromotionRequest = (body: ProcessPromotionRequest): Promise<ApiResult<PromotionListItemDto>> => apiPost<PromotionListItemDto>("/api/promotions/process", body);

/** Real academic sessions for the current school (reuses the existing
 *  session-switcher endpoint — no duplicate "list sessions" backend). */
export type PromotionAcademicSession = { id: string; name: string; code: string; isCurrent: boolean };
export function useAcademicSessions() {
  return useApiList<PromotionAcademicSession>("/api/auth/context/academic-sessions");
}
