"use client";

// Real client hooks for in-app Notifications (Phase 9D.2). Reads the live
// /api/notifications/* endpoints — no mock commNotifications store, no fake
// unread badge.
import { apiPost, type ApiResult } from "@/lib/api/client";
import { useApiList } from "./use-api";
import type { NotificationDto } from "@/lib/api/contracts";

export function useNotificationList() {
  return useApiList<NotificationDto>("/api/notifications?pageSize=50");
}

export const markNotificationReadRequest = (id: string): Promise<ApiResult<{ id: string }>> => apiPost<{ id: string }>(`/api/notifications/${id}/read`, {});
export const markAllNotificationsReadRequest = (): Promise<ApiResult<{ success: boolean }>> => apiPost<{ success: boolean }>("/api/notifications/mark-all-read", {});
