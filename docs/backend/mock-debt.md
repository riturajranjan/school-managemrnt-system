# Mock Debt Inventory — Super Admin (Platform) modules

Tracks which Super Admin surfaces are backed by real PostgreSQL/API vs the legacy
frontend mock (`db.saas` in `lib/data/seed/saas.ts`, mutated via
`lib/services/saas-service.ts`, read via `lib/selectors/saas-brief.ts`).

**Rule:** when a module goes real, its production reads/writes move to the real
API, its obsolete mock service methods are deleted, and shared mock slices are
retained **only** while another unmigrated module still consumes them. No
production code falls back to mock data on API failure — failures render real
loading/error/empty states.

_Last updated: SA-4E (Payments)._

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
| Dashboard | **PARTIAL** | real: setup-pending, active/trialing subs, MRR/ARR, overdue | `saas-brief` selectors | escalations, limit warnings, tenant health/pulse |
| Usage & Limits | MOCK | — | `db.saas.usage` | `/super-admin/usage` |
| Features/Entitlements | MOCK | — | `db.saas` overrides | `/super-admin/features` |
| Branding / Domains | MOCK | — | `db.saas` | `/super-admin/branding`, `/super-admin/domains` |
| Tenant Health | MOCK | — | `saas-brief.tenantHealth`/`platformPulse` | `/super-admin/health`, dashboard pulse |
| Global search | MOCK | — | `db.saas` (tenants/invoices/support/domains/admins) | `/super-admin/layout.tsx` command palette |

## Shared mock slices — exact remaining consumers (post SA-4E)

- **`db.saas.payments`** — **DELETED in SA-4E** (slice, `SaasPayment`/status types,
  and `use-saas.usePayments` all removed; zero remaining consumers).
- **`db.saas.subscriptions`** — still read by `saas-brief.tenantHealth` &
  `platformPulse` (the `/super-admin/health` page + the dashboard Platform Pulse
  widget) and by `use-saas.useSubscriptions`. **Cannot be deleted yet** (Tenant
  Health phase).
- **`db.saas.invoices`** — still read by the `layout.tsx` global-search command
  palette (invoice-number search) and `use-saas.useInvoices`. **Retained** — needs
  a real search source before deletion.
- Note: `db.finance.payments` is a **separate** fees/finance domain slice (school
  fee payments), unrelated to platform payments — untouched by SA-4E.

The Billing/Invoices/Payments **pages** no longer import any mock authority
(enforced by the guard). Real API failures render loading/error/empty states —
never a mock fallback.

## Removed as modules went real

- SA-3: mock `createTenant`.
- SA-4B: mock `changePlan`, `setSubscriptionStatus`.
- SA-4C: mock `extendTrial` (saas-service) and `trialRows` (saas-brief) + orphaned `TODAY()`.
- SA-4D: mock `setInvoiceStatus` (saas-service) + fake `mrrMinor`/`arrMinor`/`overdue` in `saasSummary`; invoice `mark-paid` endpoint replaced in SA-4E.
- SA-4E: **`db.saas.payments` slice deleted** + `SaasPayment`/`PaymentStatus`/`paymentStatusLabels`/`paymentStatusTone` types + `usePayments` hook; invoice `markInvoicePaid` (service + endpoint + UI) removed — settlement flows only through real payments.

## Guard

`lib/server/platform/route-mock-guard.test.ts` fails if a migrated real route
(`plans`, `subscriptions`, `trials`, `billing`, `invoices`) reintroduces a mock
authority (`useSisStore`, `saas-service`, `saas-brief`, `db.saas`).
