"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";

export function useSaas() { return useSisStore().saas; }
export function useTenants() { return useSisStore().saas.tenants; }
export function useTenant(id: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.saas.tenants.find((t) => t.id === id), [db.saas.tenants, id]);
}
export function usePlans() { return useSisStore().saas.plans; }
export function usePlan(id: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.saas.plans.find((p) => p.id === id), [db.saas.plans, id]);
}
// NOTE: mock subscription hooks + slice removed in SA-4F; mock usage hook
// (useTenantUsage) + `db.saas.usage` slice removed in SA-4G — subscriptions,
// tenant health and usage/limits are all real now.
// NOTE: mock invoice hooks (useInvoices/useInvoice) + `db.saas.invoices` slice
// removed in SA-4H — invoices are real and Global Search is server-side now.
export function useOverrides(tenantId?: string) {
  const db = useSisStore();
  return useMemo(() => (tenantId ? db.saas.overrides.filter((o) => o.tenantId === tenantId) : db.saas.overrides), [db.saas.overrides, tenantId]);
}
export function useAddons() { return useSisStore().saas.addons; }
export function useMarketplace() { return useSisStore().saas.marketplace; }
export function useDomains(tenantId?: string) {
  const db = useSisStore();
  return useMemo(() => (tenantId ? db.saas.domains.filter((d) => d.tenantId === tenantId) : db.saas.domains), [db.saas.domains, tenantId]);
}
export function useSupportTickets(tenantId?: string) {
  const db = useSisStore();
  return useMemo(() => (tenantId ? db.saas.support.filter((t) => t.tenantId === tenantId) : db.saas.support), [db.saas.support, tenantId]);
}
export function useSupportTicket(id: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.saas.support.find((t) => t.id === id), [db.saas.support, id]);
}
export function useSuccessRecords() { return useSisStore().saas.success; }
export function useAnnouncements() { return useSisStore().saas.announcements; }
export function usePlatformStatus() { return useSisStore().saas.status; }
export function usePlatformAudit() { return useSisStore().saas.auditLog; }
export function usePlatformAdmins() { return useSisStore().saas.admins; }
export function usePlatformSettings() { return useSisStore().saas.settings; }
