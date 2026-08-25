"use client";

import { useMemo } from "react";
import { usePermissions } from "@/components/providers/permissions-provider";
import type { Permission } from "@/lib/permissions/roles";
import { navGroups, mobileBottomNavItems, createActions, type NavGroup, type NavItem, type CreateAction } from "./nav-config";

// Centralised nav/quick-create visibility. Every surface that renders the
// shell's navigation (Sidebar, TabletDrawer, MobileMoreSheet, MobileBottomNav,
// QuickCreateButton, MobileFab, QuickActionsWidget) goes through this hook
// instead of importing the raw nav-config lists directly, so permission
// filtering can never drift between surfaces.
//
// An item with no `permission` field is left visible to any authenticated
// user (see NavItem.permission doc) — this hook never fabricates a gate for
// a destination that has no real backing capability yet.
//
// nav-config permission keys are plain strings (not typed against the
// client-only `Permission` union) because most of them are real DB-managed
// catalog keys (e.g. "guardians.view", "dashboard.view") that the union
// never declared — `can()` still resolves them correctly at runtime since it
// branches on the real managed-key set, not on the TS union. The cast below
// only satisfies the compiler; it changes no runtime behaviour.
function toPermission(key: string): Permission {
  return key as Permission;
}

function isItemVisible(item: NavItem, can: (key: Permission) => boolean, isPlatformAdmin: boolean): boolean {
  if (item.platformOnly) return isPlatformAdmin;
  if (!item.permission) return true;
  if (Array.isArray(item.permission)) return item.permission.some((key) => can(toPermission(key)));
  return can(toPermission(item.permission));
}

export function useVisibleNavGroups(): NavGroup[] {
  const { can, isPlatformAdmin, capabilitiesLoading } = usePermissions();
  return useMemo(() => {
    if (capabilitiesLoading) return [];
    return navGroups
      .map((group) => ({ ...group, items: group.items.filter((item) => isItemVisible(item, can, isPlatformAdmin)) }))
      .filter((group) => group.items.length > 0);
  }, [can, isPlatformAdmin, capabilitiesLoading]);
}

export function useVisibleMobileBottomNavItems(): NavItem[] {
  const { can, isPlatformAdmin, capabilitiesLoading } = usePermissions();
  return useMemo(() => {
    if (capabilitiesLoading) return [];
    return mobileBottomNavItems.filter((item) => isItemVisible(item, can, isPlatformAdmin));
  }, [can, isPlatformAdmin, capabilitiesLoading]);
}

export function useVisibleCreateActions(): CreateAction[] {
  const { can, capabilitiesLoading } = usePermissions();
  return useMemo(() => {
    if (capabilitiesLoading) return [];
    return createActions.filter((action) => can(toPermission(action.permission)));
  }, [can, capabilitiesLoading]);
}
