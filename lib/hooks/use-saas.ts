"use client";

// Mock SaaS hooks — the SHRINKING remainder that still backs the not-yet-migrated
// Add-ons / Marketplace / System (Settings / Activity / Announcements / Status)
// pages. Everything revenue/ops/config (Plans, Subscriptions, Trials, Billing,
// Invoices, Payments, Tenant Health, Usage, Global Search, Support, Dashboard,
// Impersonation, Features, Domains, Branding) is REAL and no longer here.
//
// Removed as modules went real: subscription/usage/invoice/support hooks (SA-4F–
// SA-4I) and — in SA-4L — the tenant/plan/override/domain/success hooks
// (useSaas/useTenants/useTenant/usePlans/usePlan/useOverrides/useDomains/
// useSuccessRecords), whose `db.saas.tenants/plans/overrides/domains/success`
// slices were deleted. Features/Domains/Branding use the real APIs.
import { useSisStore } from "./use-store";

export function useAddons() { return useSisStore().saas.addons; }
export function useMarketplace() { return useSisStore().saas.marketplace; }
export function useAnnouncements() { return useSisStore().saas.announcements; }
export function usePlatformStatus() { return useSisStore().saas.status; }
export function usePlatformAudit() { return useSisStore().saas.auditLog; }
export function usePlatformAdmins() { return useSisStore().saas.admins; }
export function usePlatformSettings() { return useSisStore().saas.settings; }
