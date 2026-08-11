# Mock Debt Inventory — Super Admin (Platform) modules

Tracks which Super Admin surfaces are backed by real PostgreSQL/API vs the legacy
frontend mock (`db.saas` in `lib/data/seed/saas.ts`, mutated via
`lib/services/saas-service.ts`, read via `lib/selectors/saas-brief.ts`).

**Rule:** when a module goes real, its production reads/writes move to the real
API, its obsolete mock service methods are deleted, and shared mock slices are
retained **only** while another unmigrated module still consumes them. No
production code falls back to mock data on API failure — failures render real
loading/error/empty states.

_Last updated: SA-4I (Support)._

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
| Dashboard | **MOSTLY REAL** | real: setup-pending, active/trialing subs, MRR/ARR, overdue, Pulse, attention, limit warnings, recent schools, **escalations** | `saas-brief.saasSummary` + `db.saas.tenants` | Suspended, New-this-month tiles |
| Features/Entitlements | MOCK | — | `db.saas` overrides | `/super-admin/features` |
| Branding / Domains | MOCK | — | `db.saas` | `/super-admin/branding`, `/super-admin/domains` |
| Domains / Branding | MOCK | — | `db.saas` | `/super-admin/domains`, `/super-admin/branding` |
| Add-ons / Marketplace / System | MOCK | — | `db.saas` | those pages |

## Shared mock slices — exact remaining consumers (post SA-4I)

- **`db.saas.support`** — **DELETED in SA-4I** (slice, `PlatformSupportTicket`/
  `SupportCategory`/`SupportTicketStatus`/`supportCategoryLabels`/`supportStatusTone`
  types, `use-saas.useSupportTickets`/`useSupportTicket`, `saas-service.replyTicket`/
  `setTicketStatus`, `saasSummary.supportEscalations`, and the seed; zero consumers).
- **`saas-brief.tenantHealth`** (+ `HealthState`/`TenantHealth`/`healthLabels`/
  `healthTone`) — **DELETED in SA-4I** (Support was its last consumer; the badge is
  the real SA-4F health now).
- Deleted earlier: `db.saas.invoices` (SA-4H), `db.saas.usage` (SA-4G),
  `db.saas.subscriptions` (SA-4F), `db.saas.payments` (SA-4E).
- **`db.saas.tenants`** — still read by `saas-brief.saasSummary` (dashboard tiles:
  totalSchools/activeSchools/trialSchools/suspended/setupPending/newThisMonth) +
  the `impersonation` provider. **Retained** — cannot be deleted until saasSummary
  is migrated.
- **`db.saas` (overrides/domains/addons/marketplace/admins/settings/announcements/
  success/status/auditLog)** — the still-mock Features/Domains/Branding/Add-ons/
  Marketplace/System/Settings/Activity/Announcements pages.
- Note: `db.finance.payments` is a **separate** fees/finance slice — untouched.

All migrated Super Admin pages (plans/subscriptions/trials/billing/invoices/
payments/health/usage/support) + the layout, global-search, platform-pulse &
usage-meter widgets import no mock authority (guarded). Real API failures render
loading/error/empty states — never a mock fallback.

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

## Guard

`lib/server/platform/route-mock-guard.test.ts` fails if a migrated real route
(`plans`, `subscriptions`, `trials`, `billing`, `invoices`, `payments`, `health`, `usage`, `support`)
or the `platform-pulse.tsx` / `usage-meter.tsx` / `global-search.tsx` widgets or
`app/super-admin/layout.tsx` reintroduce a mock
authority (`useSisStore`, `saas-service`, `saas-brief`, `db.saas`).
