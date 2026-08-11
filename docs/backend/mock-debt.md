# Mock Debt Inventory — Super Admin (Platform) modules

Tracks which Super Admin surfaces are backed by real PostgreSQL/API vs the legacy
frontend mock (`db.saas` in `lib/data/seed/saas.ts`, mutated via
`lib/services/saas-service.ts`, read via `lib/selectors/saas-brief.ts`).

**Rule:** when a module goes real, its production reads/writes move to the real
API, its obsolete mock service methods are deleted, and shared mock slices are
retained **only** while another unmigrated module still consumes them. No
production code falls back to mock data on API failure — failures render real
loading/error/empty states.

_Last updated: SA-4C (Trials)._

| Module | Status | Real source | Mock source (if any) | Remaining mock consumers |
|---|---|---|---|---|
| Schools | **REAL** | `schools-service` + `/api/super-admin/schools` | — | — |
| Onboarding | **REAL** | `onboarding-service` + `/api/super-admin/schools/[id]/onboarding` | — | — |
| Plans | **REAL** | `plans-service` + `/api/super-admin/plans` | — | — |
| Subscriptions | **REAL** | `subscriptions-service` + `/api/super-admin/subscriptions` | — | — |
| Trials | **REAL** | `trials-service` + `/api/super-admin/trials` | — | — |
| Dashboard | **PARTIAL** | real: setup-pending (schools), active + trialing (subscriptions) | `saas-brief` selectors | MRR/ARR, overdue, escalations, limit warnings, tenant health/pulse |
| Usage & Limits | MOCK | — | `db.saas.usage` | `/super-admin/usage` |
| Billing | MOCK | — | `db.saas` (subscriptions/invoices) | `/super-admin/billing` |
| Invoices | MOCK | — | `db.saas.invoices` | `/super-admin/invoices` |
| Payments | MOCK | — | `db.saas.payments` | `/super-admin/payments` |
| Features/Entitlements | MOCK | — | `db.saas` overrides | `/super-admin/features` |
| Branding / Domains | MOCK | — | `db.saas` | `/super-admin/branding`, `/super-admin/domains` |
| Tenant Health | MOCK | — | `saas-brief.tenantHealth` | `/super-admin/health`, dashboard |

## Shared mock slice: `db.saas.subscriptions`

Retained (read-only) because these **unmigrated** surfaces still derive from it:

- **Billing** (`/super-admin/billing`) — plan/price rollups.
- **Health / dashboard revenue** (`saas-brief`: `saasSummary`, `platformPulse`,
  `tenantHealth`, MRR/ARR) — mock revenue math.

It must NOT be deleted until Billing + the dashboard revenue metrics go real.
Trials and Subscriptions no longer read or write it.

## Removed as modules went real

- SA-3: mock `createTenant`.
- SA-4B: mock `changePlan`, `setSubscriptionStatus`.
- SA-4C: mock `extendTrial` (saas-service) and `trialRows` (saas-brief) + orphaned `TODAY()` helper.

## Guard

`lib/server/platform/route-mock-guard.test.ts` fails if a migrated real route
(`plans`, `subscriptions`, `trials`) reintroduces a mock authority
(`useSisStore`, `saas-service`, `saas-brief`, `db.saas`).
