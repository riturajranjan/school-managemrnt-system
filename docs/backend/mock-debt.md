# Mock Debt Inventory — Super Admin (Platform) modules

Tracks which Super Admin surfaces are backed by real PostgreSQL/API vs the legacy
frontend mock (`db.saas` in `lib/data/seed/saas.ts`, mutated via
`lib/services/saas-service.ts`, read via `lib/selectors/saas-brief.ts`).

**Rule:** when a module goes real, its production reads/writes move to the real
API, its obsolete mock service methods are deleted, and shared mock slices are
retained **only** while another unmigrated module still consumes them. No
production code falls back to mock data on API failure — failures render real
loading/error/empty states.

_Last updated: SA-4M (Add-ons / Marketplace)._

| Module | Status | Real source | Mock source (if any) | Remaining mock consumers |
|---|---|---|---|---|
| Schools | **REAL** | `schools-service` + `/api/super-admin/schools` | — | — |
| Onboarding | **REAL** | `onboarding-service` + `/api/super-admin/schools/[id]/onboarding` | — | — |
| Plans | **REAL** | `plans-service` + `/api/super-admin/plans` | — | — |
| Subscriptions | **REAL** | `subscriptions-service` + `/api/super-admin/subscriptions` | — | — |
| Trials | **REAL** | `trials-service` + `/api/super-admin/trials` | — | — |
| Billing | **REAL** | `billing-service` + `/api/super-admin/billing/summary` | — | — |
| Invoices | **REAL** | `invoices-service` + `/api/super-admin/invoices` | — | — |
| Payments | **REAL** | `payments-service` + `/api/super-admin/payments` | — | — |
| Tenant Health | **REAL** | `health-service` + `/api/super-admin/health` (incl. usage warnings) | — | — |
| Platform Pulse | **REAL** | `health-service` + `/api/super-admin/health/summary` | — | — |
| Usage & Limits | **REAL** | `usage-service` + `/api/super-admin/usage` (students/branches; staff/storage NOT_TRACKED) | — | — |
| Global Search | **REAL** | `search-service` + `/api/super-admin/search` (schools/subscriptions/invoices/payments/plans, permission-filtered) | — | — |
| Support | **REAL** | `support-service` + `/api/super-admin/support` (tickets/messages/notes/assign, real health badge) | — | — |
| Dashboard | **REAL** | every tile: school counts (`dashboard-service` + `/dashboard/summary`), subs, MRR/ARR, overdue, Pulse, attention, limit warnings, escalations, recent schools | — | — |
| Impersonation | **REAL** | `impersonation-service` + `/api/super-admin/impersonation[/start|/stop]`; server-authoritative `PlatformImpersonation` row (session-bound), read-only inspection, app-wide banner | — | — |
| Features/Entitlements | **REAL** | `features-service` + `/api/super-admin/features/[schoolId]`; effective = SchoolFeatureOverride ?? PlanFeature default; `hasFeature`/`requireFeature` enforcement foundation | — | — |
| Domains | **REAL** | `domains-service` + `/api/super-admin/domains[/[id]/status]`; `SchoolDomain` model, manual verification (no fake DNS/SSL) | — | — |
| Branding | **REAL** | `branding-service` + `/api/super-admin/branding/[schoolId]`; `SchoolBranding` model, URL/metadata only, `#RRGGBB`/URL validation | — | — |
| Add-ons | **REAL** | `addons-service` + `/api/super-admin/addons` + `/schools/[id]/addons`; `AddOn`/`SchoolAddOn` models, commercial snapshot, `hasAddOn` resolver (no provider billing) | — | — |
| Marketplace | **REAL** | `marketplace-service` + `/api/super-admin/marketplace` + `/schools/[id]/marketplace/[appId]/install|disable`; `MarketplaceApp`/`SchoolMarketplaceInstallation` models, honest external boundary (no OAuth/secrets), `isAppInstalled` resolver | — | — |
| System / Settings / Activity / Announcements / Status / Admins | MOCK | — | `db.saas` | `/super-admin/{settings,activity,announcements,status,audit}` |

## Shared mock slices — exact remaining consumers (post SA-4M)

- **`db.saas.addons` + `db.saas.marketplace` — DELETED in SA-4M.** Add-ons and
  marketplace apps are REAL (`AddOn`/`SchoolAddOn`/`MarketplaceApp`/
  `SchoolMarketplaceInstallation` models + services + APIs). Both pages use the
  real Schools API for school selection.
- **`db.saas.tenants` — DELETED in SA-4L** (with `db.saas.plans`, `db.saas.overrides`,
  `db.saas.domains`, `db.saas.success`). Schools/plans/features/domains/branding REAL.
- **`lib/selectors/saas-brief.ts`** — **DELETED in SA-4J** (dashboard fully real).
- Deleted earlier: `db.saas.support` + mock `tenantHealth` (SA-4I),
  `db.saas.invoices` (SA-4H), `db.saas.usage` (SA-4G), `db.saas.subscriptions`
  (SA-4F), `db.saas.payments` (SA-4E).
- **`db.saas` remaining slices** (the ONLY ones left) — `announcements`, `status`,
  `auditLog`, `admins`, `settings` — back the still-mock System (Settings /
  Activity / Announcements / Status / Audit / Admins) pages, via the trimmed
  `lib/hooks/use-saas.ts` (5 hooks remain: announcements/status/audit/admins/settings).
- Note: `db.finance.payments` is a **separate** fees/finance slice — untouched.

All migrated Super Admin pages (dashboard + plans/subscriptions/trials/billing/
invoices/payments/health/usage/support/features/domains/branding/**addons/
marketplace**) + the layout, global-search, platform-pulse & usage-meter widgets
import no mock authority (guarded). Real API failures render loading/error/empty
states — never a mock fallback.

## Removed as modules went real

- SA-3: mock `createTenant`.
- SA-4B: mock `changePlan`, `setSubscriptionStatus`.
- SA-4C: mock `extendTrial` (saas-service) and `trialRows` (saas-brief) + orphaned `TODAY()`.
- SA-4D: mock `setInvoiceStatus` (saas-service) + fake `mrrMinor`/`arrMinor`/`overdue` in `saasSummary`; invoice `mark-paid` endpoint replaced in SA-4E.
- SA-4E: **`db.saas.payments` slice deleted** + `SaasPayment`/`PaymentStatus`/`paymentStatusLabels`/`paymentStatusTone` types + `usePayments` hook; invoice `markInvoicePaid` (service + endpoint + UI) removed — settlement flows only through real payments.
- SA-4F: **`db.saas.subscriptions` slice deleted** + `TenantSubscription`/`SubscriptionStatus`(mock)/`subscriptionStatusLabels`/`subscriptionStatusTone` types + `use-saas` subscription hooks + `saasSummary.activeSubscriptions`; **`platformPulse` (saas-brief) removed**; `tenantHealth` decoupled from subscriptions (kept for Support page).
- SA-4G: **`db.saas.usage` slice deleted** + `TenantUsageMetric`/`UsageKey`/`usageKeyLabels`/`usageKeyUnit` types + `use-saas.useTenantUsage` + `saasSummary.limitWarnings`; `tenantHealth` decoupled from usage; `UsageMeter` rewritten for the real DTO. Usage integrated into real health (usage warnings → ATTENTION).
- SA-4H: **`db.saas.invoices` slice deleted** + `SaasInvoice`/`SaasInvoiceItem`/`InvoiceStatus`(mock)/`invoiceStatusLabels`/`invoiceStatusTone` types + `use-saas.useInvoices`/`useInvoice`; layout `useSaas` search removed (real server search); dashboard "Recently added schools" migrated to real Schools API.
- SA-4I: **`db.saas.support` slice deleted** + `PlatformSupportTicket`/`SupportCategory`/`SupportTicketStatus`/`supportCategoryLabels`/`supportStatusTone` types + `use-saas` support hooks + `saas-service.replyTicket`/`setTicketStatus` + `saasSummary.supportEscalations`; **mock `saas-brief.tenantHealth` (+ HealthState/TenantHealth/healthLabels/healthTone) deleted** — Support badge is real SA-4F health.
- SA-4J: **`lib/selectors/saas-brief.ts` deleted entirely** (`saasSummary`/`SaasSummary` + dead `planDistribution`/`statusDistribution`/`schoolsByMonth`); dashboard school counts + new-this-month are real (`dashboard-service` + `/api/super-admin/dashboard/summary`). Dashboard imports zero mock authority (guarded). Impersonation documented LEGACY MOCK — NOT AUTHORITY (deferred to SA-4K).
- SA-4K: **legacy mock `components/super-admin/impersonation.tsx` deleted**; real server-authoritative impersonation added (model + service + 3 APIs + authz/scope integration + app-wide banner + read-only launcher). The cosmetic `ImpersonationProvider` was removed from `app/super-admin/layout.tsx`.
- SA-4L: **`db.saas.tenants` + `db.saas.plans` + `db.saas.overrides` + `db.saas.domains` + `db.saas.success` slices deleted** + mock types (`SaasTenant`/`SaasTenantStatus`/`tenantStatus*`/`TenantLifecycleStage`/`lifecycle*`/`WhiteLabelSettings`/`SaasPlan`/`PlanStatus`(mock)/`PlanFeature`(mock)/`EntitlementLevel`/`entitlement*`/`TenantFeatureOverride`/`TenantDomain`/`DomainStatus`(mock)/`domainStatus*`/`CustomerSuccessRecord`) + `saas-service` `setTenantStatus`/`addTenantNote`/`setEntitlementOverride`/`clearEntitlementOverride` + dead `use-saas` hooks (`useSaas`/`useTenants`/`useTenant`/`usePlans`/`usePlan`/`useOverrides`/`useDomains`/`useSuccessRecords`) + dead `components/super-admin/tenant-journey.tsx`. Features/Domains/Branding are now REAL (`SchoolFeatureOverride`/`SchoolDomain`/`SchoolBranding` models + services + APIs). New enforcement foundation `features-service.hasFeature/requireFeature` (feature entitlement + RBAC).
- SA-4M: **`db.saas.addons` + `db.saas.marketplace` slices deleted** + mock types (`SaasAddon`, `MarketplaceItem`, `marketplaceStatusLabels`) + `saas-service.toggleMarketplaceItem` + dead `use-saas` hooks (`useAddons`/`useMarketplace`). Add-ons & Marketplace are now REAL (`AddOn`/`SchoolAddOn`/`MarketplaceApp`/`SchoolMarketplaceInstallation` models + `addons-service`/`marketplace-service` + APIs). Enforcement foundations `hasAddOn` / `isAppInstalled`. Real catalogs seeded (`seed-addons-marketplace.ts`). Honest external boundary: marketplace installs persist intent/status/non-secret config only — no OAuth/tokens/secrets.

## Impersonation security model (SA-4K)

- **V1 = read-only school inspection.** The actor is ALWAYS the platform admin;
  impersonation never changes their identity and never makes them SCHOOL_ADMIN.
- **Authority = a DB row** (`PlatformImpersonation`) bound 1:1 to the auth
  Session (`sessionId @unique`). Not localStorage/sessionStorage/cookies/React.
  FK cascade to Session → logout / session teardown removes it; an expired
  session never resolves a user, so the row can never authorize on its own.
- **Target tenant is derived from the target School** at start — the caller
  supplies only `schoolId` (never tenantId/roleId/permissionIds/branchId).
- **Permission**: `platform.impersonation.manage`, granted only to SUPER_ADMIN.
- **Read-only enforcement is central, not per-route**: while a row is active the
  authz resolver (`getAuthzContext`) narrows the permission set to the platform
  admin's platform perms + tenant `.view` inspection reads
  (`INSPECTION_PERMISSION_KEYS`) — no tenant write ever, so `requirePermission`
  fails closed on any mutation. `requireOrgScope` derives the target tenant/school
  server-side (never the actor's membership). One active per session; ARCHIVED
  targets are ineligible (fail closed). Audit: `IMPERSONATION_STARTED/ENDED`.

## Guard

`lib/server/platform/route-mock-guard.test.ts` fails if a migrated real route
(`plans`, `subscriptions`, `trials`, `billing`, `invoices`, `payments`, `health`, `usage`, `support`, `features`, `domains`, `branding`, `addons`, `marketplace`)
or the `platform-pulse.tsx` / `usage-meter.tsx` / `global-search.tsx` widgets or
`app/super-admin/layout.tsx` / `app/super-admin/page.tsx` reintroduce a mock
authority (`useSisStore`, `saas-service`, `saas-brief`, `db.saas`).
`lib/server/platform/impersonation-mock-guard.test.ts` additionally fails if any
impersonation source file imports a mock authority or reads localStorage/
sessionStorage.
