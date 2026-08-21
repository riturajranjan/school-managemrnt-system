"use client";

// Real client hooks for the Action Inbox (Phase 9L). Reads the live
// /api/action-inbox/* endpoints — every item is derived from an existing
// real domain, never a mock task/approval array.
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { ActionCategoryDto, ActionInboxSummaryDto, ActionItemDto, ActionPriorityDto } from "@/lib/api/contracts";

export function useActionInbox(filters: { category?: ActionCategoryDto; priority?: ActionPriorityDto } = {}) {
  return useApiList<ActionItemDto>(`/api/action-inbox${buildQuery(filters)}`);
}

export function useActionInboxSummary() {
  return useApiResource<ActionInboxSummaryDto>("/api/action-inbox/summary");
}
