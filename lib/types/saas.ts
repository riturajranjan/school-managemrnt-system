// Super Admin (SaaS control center) — the frontend mock store is GONE.
//
// The entire `db.saas` mock slice, its `SaasState`, the `use-saas` hooks and the
// `saas-service` mutations were removed across SA-4E … SA-4N as each Super Admin
// module went real (PostgreSQL + services + APIs). Dashboard, Schools, Plans,
// Subscriptions, Trials, Billing, Invoices, Payments, Tenant Health, Usage,
// Global Search, Support, Impersonation, Features, Domains, Branding, Add-ons,
// Marketplace, Settings, Platform Admins, Announcements, Status and Audit are all
// backed by real data now.
//
// The ONLY thing left here is the static reference vocabulary used by the
// read-only Permissions matrix page (`/super-admin/permissions`), which displays
// the platform role → area capability grid. (The authoritative role → permission
// mapping lives in `lib/server/authz/catalog.ts`; this is UI display only.)

/** UI role identifiers shown in the static permissions matrix. */
export type PlatformRole =
  | "platform-owner"
  | "super-admin"
  | "billing-admin"
  | "support-admin"
  | "customer-success"
  | "auditor";

export const platformRoleLabels: Record<PlatformRole, string> = {
  "platform-owner": "Platform Owner",
  "super-admin": "Super Admin",
  "billing-admin": "Billing Admin",
  "support-admin": "Support Admin",
  "customer-success": "Customer Success",
  auditor: "Read-only Auditor",
};

/** Platform capability areas shown as rows in the permissions matrix. */
export type PlatformArea =
  | "schools"
  | "plans"
  | "billing"
  | "support"
  | "domains"
  | "marketplace"
  | "announcements"
  | "settings"
  | "audit";
