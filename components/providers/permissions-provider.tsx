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

// Demo-mode role switch: real auth will resolve `role` from the session once
// a backend exists. Defaulting to the most permissive role keeps every
// Phase 2 screen usable out of the box while still letting the "Viewing as"
// switcher (see RoleSwitcher) demonstrate the gating for reviewers.
export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("super-admin");

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
