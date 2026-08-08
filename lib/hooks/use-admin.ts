"use client";

import { useSisStore } from "./use-store";

/** All admin/settings state lives under db.admin. This hook exposes it plus a
 * few convenience selectors. */
export function useAdmin() { return useSisStore().admin; }
export function useSchoolProfile() { return useSisStore().admin.schoolProfile; }
export function useBranches() { return useSisStore().admin.branches; }
export function useAcademicSessions() { return useSisStore().admin.sessions; }
export function useSystemUsers() { return useSisStore().admin.users; }
export function useRolesMeta() { return useSisStore().admin.roles; }
export function useWorkflows() { return useSisStore().admin.workflows; }
export function useCustomFields() { return useSisStore().admin.customFields; }
export function useCustomStatuses() { return useSisStore().admin.customStatuses; }
export function useBrandingSettings() { return useSisStore().admin.branding; }
export function useNumberingRules() { return useSisStore().admin.numbering; }
export function useNotificationSettings() { return useSisStore().admin.notifications; }
export function useIntegrations() { return useSisStore().admin.integrations; }
export function useModules() { return useSisStore().admin.modules; }
export function useFeatureFlags() { return useSisStore().admin.features; }
export function useSecuritySettings() { return useSisStore().admin.security; }
export function useAuditLog() { return useSisStore().admin.auditLog; }
export function usePolicies() { return useSisStore().admin.policies; }
export function useLegalDocuments() { return useSisStore().admin.legal; }
