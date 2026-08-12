"use client";

// Real client hooks for the Super Admin System surface (Settings / Admins /
// Announcements / Status / Audit), SA-4N. All read/write the live
// /api/super-admin/* endpoints — no mock store, no db.saas.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  AuditEventDto,
  PlatformAdminDto,
  PlatformAnnouncementDto,
  PlatformIncidentDto,
  PlatformSettingsDto,
  PlatformStatusDto,
} from "@/lib/api/contracts";

// --- Settings ---
export function usePlatformSettings() {
  return useApiResource<PlatformSettingsDto>("/api/super-admin/settings");
}
export const updateSettingsRequest = (body: Partial<Omit<PlatformSettingsDto, "updatedAt">>): Promise<ApiResult<PlatformSettingsDto>> =>
  apiPatch<PlatformSettingsDto>("/api/super-admin/settings", body);

// --- Platform admins ---
export function usePlatformAdmins(query: { search?: string; role?: string; status?: string } = {}) {
  return useApiList<PlatformAdminDto>(`/api/super-admin/admins${buildQuery({ search: query.search, role: query.role, status: query.status })}`);
}
export const invitePlatformAdminRequest = (body: { name: string; email: string; role: string }): Promise<ApiResult<PlatformAdminDto>> =>
  apiPost<PlatformAdminDto>("/api/super-admin/admins", body);
export const updatePlatformAdminRequest = (id: string, body: { role?: string }): Promise<ApiResult<PlatformAdminDto>> =>
  apiPatch<PlatformAdminDto>(`/api/super-admin/admins/${id}`, body);
export const setPlatformAdminStatusRequest = (id: string, status: "active" | "suspended"): Promise<ApiResult<PlatformAdminDto>> =>
  apiPost<PlatformAdminDto>(`/api/super-admin/admins/${id}/status`, { status });

// --- Announcements ---
export function usePlatformAnnouncements(status?: string) {
  return useApiList<PlatformAnnouncementDto>(`/api/super-admin/announcements${buildQuery({ status })}`);
}
export const createAnnouncementRequest = (body: { title: string; body: string; category?: string; audience?: string }): Promise<ApiResult<PlatformAnnouncementDto>> =>
  apiPost<PlatformAnnouncementDto>("/api/super-admin/announcements", body);
export const updateAnnouncementRequest = (id: string, body: Record<string, unknown>): Promise<ApiResult<PlatformAnnouncementDto>> =>
  apiPatch<PlatformAnnouncementDto>(`/api/super-admin/announcements/${id}`, body);
export const publishAnnouncementRequest = (id: string): Promise<ApiResult<PlatformAnnouncementDto>> =>
  apiPost<PlatformAnnouncementDto>(`/api/super-admin/announcements/${id}/publish`, {});
export const archiveAnnouncementRequest = (id: string): Promise<ApiResult<PlatformAnnouncementDto>> =>
  apiPost<PlatformAnnouncementDto>(`/api/super-admin/announcements/${id}/archive`, {});

// --- Status + incidents ---
export function usePlatformStatus() {
  return useApiResource<PlatformStatusDto>("/api/super-admin/status");
}
export const createIncidentRequest = (body: { title: string; description?: string; severity?: string }): Promise<ApiResult<PlatformIncidentDto>> =>
  apiPost<PlatformIncidentDto>("/api/super-admin/status/incidents", body);
export const updateIncidentRequest = (id: string, body: { status?: string; severity?: string; description?: string }): Promise<ApiResult<PlatformIncidentDto>> =>
  apiPatch<PlatformIncidentDto>(`/api/super-admin/status/incidents/${id}`, body);
export const resolveIncidentRequest = (id: string): Promise<ApiResult<PlatformIncidentDto>> =>
  apiPost<PlatformIncidentDto>(`/api/super-admin/status/incidents/${id}/resolve`, {});

// --- Audit / Activity (read-only) ---
export function useAuditEvents(query: { page?: number; pageSize?: number; search?: string; action?: string; actor?: string; schoolId?: string } = {}) {
  return useApiList<AuditEventDto>(`/api/super-admin/audit${buildQuery({ page: query.page, pageSize: query.pageSize, search: query.search, action: query.action, actor: query.actor, schoolId: query.schoolId })}`);
}
