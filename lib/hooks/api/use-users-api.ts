"use client";

// Real client hooks for hierarchical account provisioning (Phase 9W.2) —
// GET /api/users*, POST /api/users/provision, PATCH .../status,
// POST .../roles. No mock store, no client-maintained role policy: the
// provisionable-roles list and every authorization decision come from the
// server.
import { apiPatch, apiPost } from "@/lib/api/client";
import { buildQuery, useApiList, useApiMutation, useApiResource } from "./use-api";

export type ProvisionableRole = { key: string; name: string };

export type AccountListItem = {
  id: string;
  name: string | null;
  email: string;
  status: string;
  passwordSetupRequired: boolean;
  roles: { key: string; name: string }[];
  staffId: string | null;
  studentId: string | null;
  guardianId: string | null;
  createdAt: string;
};

export type ProvisionAccountInput = {
  targetRoleKey: string;
  email: string;
  name?: string;
  staffId?: string;
  studentId?: string;
  guardianId?: string;
};

export type ProvisionAccountResult = {
  userId: string;
  targetRoleKey: string;
  accountCreated: boolean;
  accountLinked: boolean;
  passwordSetupPending: boolean;
  passwordSetupUrl: string | null;
};

export function useProvisionableRoles() {
  return useApiResource<ProvisionableRole[]>("/api/users/provisionable-roles");
}

export function useAccounts(params: { search?: string; page?: number; pageSize?: number } = {}) {
  return useApiList<AccountListItem>(`/api/users${buildQuery(params)}`);
}

export function useProvisionAccount() {
  return useApiMutation((input: ProvisionAccountInput) => apiPost<ProvisionAccountResult>("/api/users/provision", input));
}

export function useSetAccountStatus() {
  return useApiMutation((userId: string, status: "ACTIVE" | "SUSPENDED") => apiPatch<{ success: true }>(`/api/users/${userId}/status`, { status }));
}

export function useAssignRole() {
  return useApiMutation((userId: string, targetRoleKey: string) => apiPost<{ success: true }>(`/api/users/${userId}/roles`, { targetRoleKey }));
}
