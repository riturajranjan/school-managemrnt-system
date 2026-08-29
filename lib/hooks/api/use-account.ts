"use client";

// Real client hooks for the logged-in user's own account — avatar dropdown,
// /profile, /settings. Reads/writes the live /api/me/* endpoints; no mock
// identity or hardcoded display name anywhere below.
import { apiDelete, apiPost, type ApiResult } from "@/lib/api/client";
import { useApiResource } from "./use-api";
import type { ChangePasswordRequest, MyProfileDto, MySessionDto } from "@/lib/api/contracts";

export function useMyProfile() {
  return useApiResource<MyProfileDto>("/api/me/profile");
}

export const changePasswordRequest = (body: ChangePasswordRequest): Promise<ApiResult<{ changed: true }>> =>
  apiPost<{ changed: true }>("/api/me/password", body);

export function useMySessions() {
  return useApiResource<MySessionDto[]>("/api/me/sessions");
}

export const revokeSessionRequest = (sessionId: string): Promise<ApiResult<{ revoked: true }>> => apiDelete<{ revoked: true }>(`/api/me/sessions/${sessionId}`);

// Convenience: initials for an avatar when there's no photo, from a real name/email only.
export function initialsFrom(name: string | null, email: string): string {
  const source = (name ?? "").trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
