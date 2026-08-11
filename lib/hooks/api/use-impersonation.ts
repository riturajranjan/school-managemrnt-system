"use client";

// Real impersonation requests (Super Admin SA-4K). Thin wrappers over the
// server-authoritative endpoints — the target school is the only input; the
// server derives the tenant and enforces the read-only policy. No mock store.
import { apiGet, apiPost, type ApiResult } from "@/lib/api/client";

export type ImpersonationState =
  | { active: false }
  | {
      active: true;
      school: { id: string; name: string };
      tenant: { id: string; name: string };
      startedAt: string;
      readOnly: true;
    };

export const startImpersonationRequest = (schoolId: string): Promise<ApiResult<ImpersonationState>> =>
  apiPost<ImpersonationState>("/api/super-admin/impersonation/start", { schoolId });

export const stopImpersonationRequest = (): Promise<ApiResult<ImpersonationState>> =>
  apiPost<ImpersonationState>("/api/super-admin/impersonation/stop", {});

export const getImpersonationRequest = (): Promise<ApiResult<ImpersonationState>> =>
  apiGet<ImpersonationState>("/api/super-admin/impersonation");
