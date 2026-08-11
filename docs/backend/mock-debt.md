# Mock Debt Inventory — Super Admin (Platform) modules

Tracks which Super Admin surfaces are backed by real PostgreSQL/API vs the legacy
frontend mock (`db.saas` in `lib/data/seed/saas.ts`, mutated via
`lib/services/saas-service.ts`, read via `lib/selectors/saas-brief.ts`).

**Rule:** when a module goes real, its production reads/writes move to the real
API, its obsolete mock service methods are deleted, and shared mock slices are
retained **only** while another unmigrated module still consumes them. No
production code falls back to mock data on API failure — failures render real
loading/error/empty states.

_Last updated: SA-4K (Secure impersonation)._

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
| Features/Entitlements | MOCK | — | `db.saas` overrides | `/super-admin/features` |
| Branding / Domains | MOCK | — | `db.saas` | `/super-admin/branding`, `/super-admin/domains` |
| Domains / Branding | MOCK | — | `db.saas` | `/super-admin/domains`, `/super-admin/branding` |
| Add-ons / Marketplace / System | MOCK | — | `db.saas` | those pages |

## Shared mock slices — exact remaining consumers (post SA-4K)

- **`lib/selectors/saas-brief.ts`** (whole file incl. `saasSummary` + dead
  `planDistribution`/`statusDistribution`/`schoolsByMonth`) — **DELETED in SA-4J**;
  the dashboard is fully real (`dashboard-service`).
- Deleted earlier: `db.saas.support` + mock `tenantHealth` (SA-4I),
  `db.saas.invoices` (SA-4H), `db.saas.usage` (SA-4G), `db.saas.subscriptions`
  (SA-4F), `db.saas.payments` (SA-4E).
- **`db.saas.tenants`** — STILL read by the still-mock **Features** (`/super-admin/
  features`), **Domains** (`/super-admin/domains`), **Branding** (`/super-admin/
  branding`) pages (tenant pickers, via `lib/hooks/use-saas.ts`). **Retained**
  until those pages migrate. The dashboard, search, health and **impersonation
  (now real)** no longer read it.
- **Impersonation** — **REAL as of SA-4K.** Server-authoritative: a
  `PlatformImpersonation` row bound 1:1 to the auth Session (unique `sessionId`,
  FK cascade). The legacy React-state-only mock (`components/super-admin/
  impersonation.tsx`) is **DELETED**. Client state comes only from
  `/api/auth/capabilities` + `/api/super-admin/impersonation`; never localStorage/
  sessionStorage/`db.saas`. See the security model below.
- **`db.saas` (overrides/domains/addons/marketplace/admins/settings/announcements/
  success/status/auditLog)** — the still-mock Features/Domains/Branding/Add-ons/
  Marketplace/System/Settings/Activity/Announcements pages.
- Note: `db.finance.payments` is a **separate** fees/finance slice — untouched.

All migrated Super Admin pages (dashboard + plans/subscriptions/trials/billing/
invoices/payments/health/usage/support) + the layout, global-search,
platform-pulse & usage-meter widgets import no mock authority (guarded). Real API
failures render loading/error/empty states — never a mock fallback.

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
(`plans`, `subscriptions`, `trials`, `billing`, `invoices`, `payments`, `health`, `usage`, `support`)
or the `platform-pulse.tsx` / `usage-meter.tsx` / `global-search.tsx` widgets or
`app/super-admin/layout.tsx` reintroduce a mock
authority (`useSisStore`, `saas-service`, `saas-brief`, `db.saas`).
`lib/server/platform/impersonation-mock-guard.test.ts` additionally fails if any
impersonation source file imports a mock authority or reads localStorage/
sessionStorage.
