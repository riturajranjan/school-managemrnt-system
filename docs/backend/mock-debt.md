# Mock Debt Inventory — Super Admin (Platform) modules

Tracks which Super Admin surfaces are backed by real PostgreSQL/API vs the legacy
frontend mock (`db.saas` in `lib/data/seed/saas.ts`, mutated via
`lib/services/saas-service.ts`, read via `lib/selectors/saas-brief.ts`).

**Rule:** when a module goes real, its production reads/writes move to the real
API, its obsolete mock service methods are deleted, and shared mock slices are
retained **only** while another unmigrated module still consumes them. No
production code falls back to mock data on API failure — failures render real
loading/error/empty states.

_Last updated: SA-4G (Usage & Limits)._

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
| Dashboard | **MOSTLY REAL** | real: setup-pending, active/trialing subs, MRR/ARR, overdue, Pulse, attention list, **limit warnings** | `saas-brief.saasSummary` + `db.saas.tenants` | Suspended, New-this-month, Escalations tiles + "Recently added schools" list |
| Features/Entitlements | MOCK | — | `db.saas` overrides | `/super-admin/features` |
| Branding / Domains | MOCK | — | `db.saas` | `/super-admin/branding`, `/super-admin/domains` |
| Support | MOCK | — | `db.saas.support` + `saas-brief.tenantHealth` (badge) | `/super-admin/support/*` |
| Global search | MOCK | — | `db.saas` (tenants/invoices/support/domains/admins) | `/super-admin/layout.tsx` command palette |

## Shared mock slices — exact remaining consumers (post SA-4G)

- **`db.saas.usage`** — **DELETED in SA-4G** (slice, `TenantUsageMetric`/`UsageKey`/
  `usageKeyLabels`/`usageKeyUnit` types, `use-saas.useTenantUsage`, and the usage
  dependency of `saasSummary.limitWarnings` + `saas-brief.tenantHealth`; zero
  remaining consumers).
- **`db.saas.subscriptions`** — DELETED in SA-4F.
- **`db.saas.payments`** — DELETED in SA-4E.
- **`db.saas.invoices`** — still read by the `layout.tsx` global-search command
  palette + `use-saas.useInvoices`. **Retained** — needs a real search source.
- **`db.saas.tenants`** — still read by the dashboard "Recently added schools"
  list + `saasSummary` tiles + layout search. Retained (Tenants not yet a real
  Super-Admin domain — real Schools live under `/api/super-admin/schools`).
- **`db.saas.support`** — Support page (tickets) + `saasSummary.supportEscalations`.
- **`saas-brief.tenantHealth`** — RETAINED (mock) for the Support ticket page badge
  only; no longer reads `db.saas.subscriptions` or `db.saas.usage`.
- Note: `db.finance.payments` is a **separate** fees/finance slice — untouched.

The Health/Usage pages + Platform Pulse & usage-meter widgets import no mock
authority (guarded). Real API failures render loading/error/empty states.

## Removed as modules went real

- SA-3: mock `createTenant`.
- SA-4B: mock `changePlan`, `setSubscriptionStatus`.
- SA-4C: mock `extendTrial` (saas-service) and `trialRows` (saas-brief) + orphaned `TODAY()`.
- SA-4D: mock `setInvoiceStatus` (saas-service) + fake `mrrMinor`/`arrMinor`/`overdue` in `saasSummary`; invoice `mark-paid` endpoint replaced in SA-4E.
- SA-4E: **`db.saas.payments` slice deleted** + `SaasPayment`/`PaymentStatus`/`paymentStatusLabels`/`paymentStatusTone` types + `usePayments` hook; invoice `markInvoicePaid` (service + endpoint + UI) removed — settlement flows only through real payments.
- SA-4F: **`db.saas.subscriptions` slice deleted** + `TenantSubscription`/`SubscriptionStatus`(mock)/`subscriptionStatusLabels`/`subscriptionStatusTone` types + `use-saas` subscription hooks + `saasSummary.activeSubscriptions`; **`platformPulse` (saas-brief) removed**; `tenantHealth` decoupled from subscriptions (kept for Support page).
- SA-4G: **`db.saas.usage` slice deleted** + `TenantUsageMetric`/`UsageKey`/`usageKeyLabels`/`usageKeyUnit` types + `use-saas.useTenantUsage` + `saasSummary.limitWarnings`; `tenantHealth` decoupled from usage; `UsageMeter` rewritten for the real DTO. Usage integrated into real health (usage warnings → ATTENTION).

## Guard

`lib/server/platform/route-mock-guard.test.ts` fails if a migrated real route
(`plans`, `subscriptions`, `trials`, `billing`, `invoices`, `payments`, `health`, `usage`)
or the `platform-pulse.tsx` / `usage-meter.tsx` widgets reintroduce a mock
authority (`useSisStore`, `saas-service`, `saas-brief`, `db.saas`).
