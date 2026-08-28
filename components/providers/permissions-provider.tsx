"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api/client";
import { hasPermission, type Permission, type UserRole } from "@/lib/permissions/roles";

type AssignedRole = { id: string; key: string; name: string; uiRole: UserRole | null };

/** Server-authoritative impersonation state (SA-4K) — mirrors the API DTO. */
export type ImpersonationState =
  | { active: false }
  | {
      active: true;
      school: { id: string; name: string };
      tenant: { id: string; name: string };
      startedAt: string;
      readOnly: true;
    };

type PermissionsContextValue = {
  role: UserRole;
  setRole: (role: UserRole) => void; // switches among genuinely-assigned roles only
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  /** Real server-resolved permission keys (DB). Authoritative for capability rendering. */
  serverPermissions: Set<string>;
  hasServerPermission: (key: string) => boolean;
  isPlatformAdmin: boolean;
  assignedRoles: AssignedRole[];
  capabilitiesLoading: boolean;
  /** Active read-only school inspection, or { active:false }. UI gating only. */
  impersonation: ImpersonationState;
  /** True while inspecting a school read-only — hide/disable write actions. */
  isReadOnlyInspection: boolean;
  /** Stop impersonation server-side, then reload capabilities + refresh routes. */
  stopImpersonation: () => Promise<void>;
};

type Capabilities = {
  permissions: string[];
  managedPermissionKeys: string[];
  uiRole: UserRole | null;
  isPlatformAdmin: boolean;
  assignedRoles: AssignedRole[];
  impersonation: ImpersonationState;
};

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

// Authorization is now server-side (see lib/server/authz). This provider fetches
// the user's REAL active role + permission set from /api/auth/capabilities and
// uses them for UI rendering only — no hardcoded default role, no client-side
// switch to an unassigned role. The role-keyed matrix in lib/permissions/roles
// remains a UI-rendering convenience, now driven by the real role. Server APIs
// independently enforce permissions.
export function PermissionsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  // "teacher" is the least-privileged fallback used only until capabilities load
  // (never grants access — the server is authoritative).
  const [role, setRoleState] = useState<UserRole>("teacher");
  const [serverPermissions, setServerPermissions] = useState<Set<string>>(new Set());
  const [managedKeys, setManagedKeys] = useState<Set<string>>(new Set());
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [assignedRoles, setAssignedRoles] = useState<AssignedRole[]>([]);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [impersonation, setImpersonation] = useState<ImpersonationState>({ active: false });

  // A transient failure here (cold serverless/DB start, brief network blip)
  // must never be indistinguishable from a confirmed "not a platform admin" /
  // wrong-role result — the UI-only fallback role below ("teacher") would
  // otherwise render as the user's real identity for anyone who isn't a
  // teacher (most visibly a Platform Super Admin: a fresh production login
  // hitting a cold database connection could see themselves gated out with
  // "Your role (Teacher)" even though the server-side session and RBAC
  // resolution — the authoritative check — already confirmed platform admin
  // access before this component ever rendered). Retry a few times with
  // backoff before giving up; stop immediately on a genuine UNAUTHENTICATED
  // response (no session — retrying can't fix that).
  const load = useCallback(async (): Promise<Capabilities | null> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await apiGet<Capabilities>("/api/auth/capabilities");
      if (res.success) return res.data;
      if (res.error.code === "UNAUTHENTICATED") return null;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
    return null;
  }, []);

  const apply = useCallback((data: Capabilities | null) => {
    if (data) {
      if (data.uiRole) setRoleState(data.uiRole);
      setServerPermissions(new Set(data.permissions));
      setManagedKeys(new Set(data.managedPermissionKeys));
      setIsPlatformAdmin(data.isPlatformAdmin);
      setAssignedRoles(data.assignedRoles);
      setImpersonation(data.impersonation ?? { active: false });
    }
    setCapabilitiesLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    load().then((d) => {
      if (active) apply(d);
    });
    return () => {
      active = false;
    };
  }, [load, apply]);

  // Switch the active role — only if it's genuinely assigned. Persists via the
  // real context API and re-resolves capabilities; server validates independently.
  const setRole = useCallback(
    async (target: UserRole) => {
      const match = assignedRoles.find((r) => r.uiRole === target);
      if (!match) return; // ignore attempts to select an unassigned role
      const res = await apiPost("/api/auth/context/role", { roleId: match.id });
      if (!res.success) return;
      apply(await load());
      router.refresh();
    },
    [assignedRoles, load, apply, router],
  );

  // For a permission key the DB catalog manages, the REAL server permission set
  // is authoritative for UI rendering; for fine-grained UI-only keys the catalog
  // doesn't model yet, fall back to the role-keyed matrix (display convenience).
  // Either way the server independently enforces access — UI hiding is not security.
  const can = useCallback(
    (permission: Permission) =>
      managedKeys.has(permission) ? serverPermissions.has(permission) : hasPermission(role, permission),
    [managedKeys, serverPermissions, role],
  );

  // Stop server-authoritative impersonation, then re-resolve capabilities (which
  // drops the read-only inspection permissions) and refresh the current route.
  const stopImpersonation = useCallback(async () => {
    const res = await apiPost("/api/super-admin/impersonation/stop", {});
    if (!res.success) return;
    apply(await load());
    router.refresh();
  }, [apply, load, router]);

  const value = useMemo<PermissionsContextValue>(
    () => ({
      role,
      setRole: (r) => void setRole(r),
      can,
      canAny: (permissions) => permissions.some((p) => can(p)),
      serverPermissions,
      hasServerPermission: (key) => serverPermissions.has(key),
      isPlatformAdmin,
      assignedRoles,
      capabilitiesLoading,
      impersonation,
      isReadOnlyInspection: impersonation.active === true,
      stopImpersonation,
    }),
    [role, setRole, can, serverPermissions, isPlatformAdmin, assignedRoles, capabilitiesLoading, impersonation, stopImpersonation],
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}
