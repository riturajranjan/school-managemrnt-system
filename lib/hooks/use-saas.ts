"use client";

// Mock SaaS hooks — the SHRINKING remainder that still backs the not-yet-migrated
// System pages (Settings / Activity / Announcements / Status / Audit / Admins).
// Everything else (Plans, Subscriptions, Trials, Billing, Invoices, Payments,
// Tenant Health, Usage, Global Search, Support, Dashboard, Impersonation,
// Features, Domains, Branding, Add-ons, Marketplace) is REAL and no longer here.
//
// Removed as modules went real: subscription/usage/invoice/support hooks (SA-4F–
// SA-4I); the tenant/plan/override/domain/success hooks (SA-4L); and — in SA-4M —
// the add-ons/marketplace hooks (useAddons/useMarketplace), whose
// `db.saas.addons`/`db.saas.marketplace` slices were deleted. Add-ons &
// Marketplace use the real APIs.
import { useSisStore } from "./use-store";

export function useAnnouncements() { return useSisStore().saas.announcements; }
export function usePlatformStatus() { return useSisStore().saas.status; }
export function usePlatformAudit() { return useSisStore().saas.auditLog; }
export function usePlatformAdmins() { return useSisStore().saas.admins; }
export function usePlatformSettings() { return useSisStore().saas.settings; }
