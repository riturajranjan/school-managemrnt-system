# Mock Debt Inventory — Super Admin (Platform) modules

Tracks which Super Admin surfaces are backed by real PostgreSQL/API vs the legacy
frontend mock (`db.saas` in `lib/data/seed/saas.ts`, mutated via
`lib/services/saas-service.ts`, read via `lib/selectors/saas-brief.ts`).

**Rule:** when a module goes real, its production reads/writes move to the real
API, its obsolete mock service methods are deleted, and shared mock slices are
retained **only** while another unmigrated module still consumes them. No
production code falls back to mock data on API failure — failures render real
loading/error/empty states.

_Last updated: SA-4D (Billing + Invoices)._

| Module | Status | Real source | Mock source (if any) | Remaining mock consumers |
|---|---|---|---|---|
| Schools | **REAL** | `schools-service` + `/api/super-admin/schools` | — | — |
| Onboarding | **REAL** | `onboarding-service` + `/api/super-admin/schools/[id]/onboarding` | — | — |
| Plans | **REAL** | `plans-service` + `/api/super-admin/plans` | — | — |
| Subscriptions | **REAL** | `subscriptions-service` + `/api/super-admin/subscriptions` | — | — |
| Trials | **REAL** | `trials-service` + `/api/super-admin/trials` | — | — |
| Billing | **REAL** | `billing-service` + `/api/super-admin/billing/summary` | — | — |
| Invoices | **REAL** | `invoices-service` + `/api/super-admin/invoices` | — | — |
| Dashboard | **PARTIAL** | real: setup-pending, active/trialing subs, MRR/ARR, overdue | `saas-brief` selectors | escalations, limit warnings, tenant health/pulse |
| Usage & Limits | MOCK | — | `db.saas.usage` | `/super-admin/usage` |
| Payments | MOCK | — | `db.saas.payments` | `/super-admin/payments` |
| Features/Entitlements | MOCK | — | `db.saas` overrides | `/super-admin/features` |
| Branding / Domains | MOCK | — | `db.saas` | `/super-admin/branding`, `/super-admin/domains` |
| Tenant Health | MOCK | — | `saas-brief.tenantHealth`/`platformPulse` | `/super-admin/health`, dashboard pulse |
| Global search | MOCK | — | `db.saas` (tenants/invoices/support/domains/admins) | `/super-admin/layout.tsx` command palette |

## Shared mock slices — exact remaining consumers (post SA-4D)

- **`db.saas.subscriptions`** — still read by `saas-brief.tenantHealth` &
  `platformPulse` (the `/super-admin/health` page + the dashboard Platform Pulse
  widget), and by `use-saas.useSubscriptions`. **Cannot be deleted yet.**
- **`db.saas.invoices`** — still read by the `layout.tsx` global-search command
  palette (invoice-number search) and `use-saas.useInvoices`. Retained.
- **`db.saas.payments`** — still read by `/super-admin/payments` (unmigrated) and
  the fees/finance domain. Retained for the Payments phase.

The Billing/Invoices **pages** no longer import any mock authority (enforced by
the guard). Real API failures render loading/error/empty states — never a mock
fallback.

## Removed as modules went real

- SA-3: mock `createTenant`.
- SA-4B: mock `changePlan`, `setSubscriptionStatus`.
- SA-4C: mock `extendTrial` (saas-service) and `trialRows` (saas-brief) + orphaned `TODAY()`.
- SA-4D: mock `setInvoiceStatus` (saas-service) and the fake `mrrMinor`/`arrMinor`/`overdue` fields in `saasSummary` (saas-brief).

## Guard

`lib/server/platform/route-mock-guard.test.ts` fails if a migrated real route
(`plans`, `subscriptions`, `trials`, `billing`, `invoices`) reintroduces a mock
authority (`useSisStore`, `saas-service`, `saas-brief`, `db.saas`).
