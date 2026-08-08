"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { hasAnyPermission, hasPermission, type Permission, type UserRole } from "@/lib/permissions/roles";

type PermissionsContextValue = {
  role: UserRole;
  setRole: (role: UserRole) => void;
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
};

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

// `initialRole` is resolved SERVER-SIDE from the real session (see the root
// layout gate) and seeds the initial UI view. The "Viewing as" switcher may
// still change it locally for reviewers, but this only affects UI affordances —
// server guards remain the authorization boundary. Falls back to the most
// permissive role when unauthenticated (e.g. pre-database UI review).
export function PermissionsProvider({ children, initialRole }: { children: ReactNode; initialRole?: UserRole }) {
  const [role, setRole] = useState<UserRole>(initialRole ?? "super-admin");

  const value = useMemo<PermissionsContextValue>(
    () => ({
      role,
      setRole,
      can: (permission) => hasPermission(role, permission),
      canAny: (permissions) => hasAnyPermission(role, permissions),
    }),
    [role],
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
