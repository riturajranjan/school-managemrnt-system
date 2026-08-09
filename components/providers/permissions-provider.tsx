"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api/client";
import { hasAnyPermission, hasPermission, type Permission, type UserRole } from "@/lib/permissions/roles";

type AssignedRole = { id: string; key: string; name: string; uiRole: UserRole | null };

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
};

type Capabilities = {
  permissions: string[];
  uiRole: UserRole | null;
  isPlatformAdmin: boolean;
  assignedRoles: AssignedRole[];
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
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [assignedRoles, setAssignedRoles] = useState<AssignedRole[]>([]);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await apiGet<Capabilities>("/api/auth/capabilities");
    return res.success ? res.data : null;
  }, []);

  const apply = useCallback((data: Capabilities | null) => {
    if (data) {
      if (data.uiRole) setRoleState(data.uiRole);
      setServerPermissions(new Set(data.permissions));
      setIsPlatformAdmin(data.isPlatformAdmin);
      setAssignedRoles(data.assignedRoles);
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

  const value = useMemo<PermissionsContextValue>(
    () => ({
      role,
      setRole: (r) => void setRole(r),
      can: (permission) => hasPermission(role, permission),
      canAny: (permissions) => hasAnyPermission(role, permissions),
      serverPermissions,
      hasServerPermission: (key) => serverPermissions.has(key),
      isPlatformAdmin,
      assignedRoles,
      capabilitiesLoading,
    }),
    [role, setRole, serverPermissions, isPlatformAdmin, assignedRoles, capabilitiesLoading],
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
