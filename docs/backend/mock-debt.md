# Mock Debt Inventory — System-Wide (Phase 9W)

This document was originally Super-Admin-only (SA-4N). Phase 9W expands it to
cover every domain in the app, per the system-wide production-readiness audit.
The Super Admin section below is unchanged from SA-4N and remains accurate.
Everything under "System-wide mock debt (Phase 9W)" is new.

---

# Super Admin (Platform) modules

## ✅ SUPER ADMIN MOCK DEBT: NONE

As of SA-4N, EVERY Super Admin surface is backed by real PostgreSQL + Prisma +
services + REST APIs. The legacy `db.saas` frontend mock store, its `SaasState`,
the `use-saas` hooks, the `saas-service` mutations, the `saas-brief` selectors and
the `seed/saas.ts` seed have all been **DELETED**. No production Super Admin code
falls back to mock data on API failure — failures render real loading/error/empty
states.

_Last updated: SA-4N (System — final; db.saas removed)._

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
| Settings | **REAL** | `settings-service` + `/api/super-admin/settings`; `PlatformSetting` singleton, safe non-secret config only | — | — |
| Platform Admins | **REAL** | `platform-admins-service` + `/api/super-admin/admins[/[id][/status]]`; real `PlatformAdmin`/`User`, honest invite (no email), last-super-admin protection | — | — |
| Announcements | **REAL** | `announcements-service` + `/api/super-admin/announcements[/[id]/publish|/archive]`; `PlatformAnnouncement`, DRAFT/PUBLISHED/ARCHIVED, in-app only (no delivery) | — | — |
| Status | **REAL** | `status-service` + `/api/super-admin/status[/incidents…]`; honest signals (DB reachable + maintenance + `PlatformIncident`), unmonitored services labelled | — | — |
| Audit / Activity | **REAL** | `audit-service` + `/api/super-admin/audit`; paginated/filtered READ view over the real `AuditEvent` table, safe DTO, immutable | — | — |

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
- **The entire `db.saas` store slice — DELETED in SA-4N** (`announcements`,
  `status`, `auditLog`, `admins`, `settings` — the last five). `lib/hooks/use-saas.ts`,
  `lib/services/saas-service.ts` (+test) and `lib/data/seed/saas.ts` are DELETED;
  `SaasState` and the `saas` field/hydration/persistence are removed from
  `lib/data/store.ts`. `lib/types/saas.ts` is trimmed to only the static UI
  vocabulary (`PlatformRole`/`platformRoleLabels`/`PlatformArea`) used by the
  read-only Permissions matrix page.
- Note: `db.finance.payments` and other **school-side** mock slices are a SEPARATE
  concern (future school phases) — untouched by the Super Admin migration.

EVERY Super Admin page imports no mock authority (guarded by
`route-mock-guard.test.ts`, which now covers all migrated dirs). Real API failures
render loading/error/empty states — never a mock fallback.

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
- SA-4N (FINAL): Settings/Admins/Announcements/Status/Audit/Activity are REAL (`PlatformSetting` singleton, `PlatformAnnouncement`, `PlatformIncident` models; `PlatformAdmin`/`User` reused; `AuditEvent` reused for Audit+Activity). New services `settings-service`/`platform-admins-service`/`announcements-service`/`status-service`/`audit-service` + APIs; catalog perms `platform.{admins,announcements,status}.{view,manage}`. **The entire `db.saas` store slice + `SaasState` + `use-saas.ts` + `saas-service.ts`(+test) + `seed/saas.ts` DELETED**; `lib/data/store.ts` no longer has a `saas` field; `lib/types/saas.ts` trimmed to the static Permissions-matrix vocabulary only. Honest boundaries: admin invite is "Invitation pending" (no email); announcements are in-app only (no delivery); status reports only measurable signals (DB reachable + maintenance + manual incidents), unmonitored services labelled; audit is read-only/immutable with a secret-stripping safe DTO. Last-super-admin protection enforced server-side. **SUPER ADMIN MOCK DEBT = NONE.**

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
(`plans`, `subscriptions`, `trials`, `billing`, `invoices`, `payments`, `health`, `usage`, `support`, `features`, `domains`, `branding`, `addons`, `marketplace`, `settings`, `announcements`, `status`, `audit`, `activity`)
or the `platform-pulse.tsx` / `usage-meter.tsx` / `global-search.tsx` widgets or
`app/super-admin/layout.tsx` / `app/super-admin/page.tsx` reintroduce a mock
authority (`useSisStore`, `saas-service`, `saas-brief`, `db.saas`). (`/super-admin/
permissions` is a static read-only reference matrix — no data layer.)
`lib/server/platform/impersonation-mock-guard.test.ts` additionally fails if any
impersonation source file imports a mock authority or reads localStorage/
sessionStorage.

---

# System-wide mock debt (Phase 9W)

See `docs/backend/production-readiness.md` for the full domain-by-domain route
matrix, financial/concurrency/privacy verification, and fix log. This section is
the flat mock-debt inventory required by Phase 9W section 37: every remaining mock
surface, grouped by disposition, with its reason and recommended future phase.

## INTENTIONALLY DEFERRED (documented in code/route-mock-guard, no real backing exists)

These render a fully realistic UI with no visible end-user "not real" signal (see
the labeling-honesty note in `production-readiness.md`) but ARE accurately
documented in source comments and `route-mock-guard.test.ts`, and their absence is
a deliberate, previously-stated scope boundary (no invented policy/workflow).

| Surface | Mock source | Missing prerequisite | Future phase |
|---|---|---|---|
| `app/academics/classes/[classId]/page.tsx` (class detail) | `useSisStore` | none — small, could be migrated | Academics follow-up |
| `app/teacher/evaluations/page.tsx` | `useSisStore` + `CURRENT_TEACHER_ID` | real homework-grading/evaluation model | Academics follow-up |
| `app/hr/{recruitment,candidates,jobs,interviews,onboarding,offboarding,performance,appraisals,goals,training,courses,analytics,announcements,contracts,documents,feedback,letters,org-chart,policies,shifts}` (HR non-core) | `useSisStore` + `lib/services/hr-service.ts` | recruitment/performance/contract/training policy models | HR follow-up phase |
| `app/hr/attendance/page.tsx`, `app/hr/leave/page.tsx`, `app/hr/leave/calendar/page.tsx` | `useSisStore` + `hr-service` | none — these are exact duplicates of the already-real `/attendance/staff` and `/attendance/leave` (Phase 9E); recommend deleting these pages and redirecting, not migrating a second implementation | HR follow-up (small — redirect, not rebuild) |
| `app/exams/[examId]/students/page.tsx` | `lib/services/exam-service.ts` | none, small — could be migrated | Exams follow-up |
| `app/exams/[examId]/publish/page.tsx` | `lib/services/publication-service.ts` → `result-processing-service.ts` | duplicates real publish flow elsewhere in 8C — small, could be migrated | Exams follow-up |
| `app/exams/[examId]/attendance/page.tsx` | mock (per Phase 8A guard note) | real Attendance exists; this is a duplicate surface | Exams follow-up |
| `app/marks/import/page.tsx` | mock CSV importer | real Marks entry exists; import path never linked | Exams follow-up |
| `app/grading/rules/page.tsx` | `lib/hooks/use-exams.ts` (mock) + `lib/services/grading-service.ts` | duplicates real `/grading/schemes` (Phase 8C) | Exams follow-up |
| `app/health/{incidents,appointments,reports}` | `campus-service` / `useSisStore` | Incident/Appointment-scheduling/Vaccination models | Health follow-up |
| `app/health/medications/page.tsx` | `campus-service.recordMedication/setMedicationStatus` | real prescription/dosage-schedule authority (medication *administration* is already real, per-visit; this page is a schedule/status workflow with no real backing) | Health follow-up |
| `app/counselling/resources/page.tsx` | `useSisStore` | resource-library model | Counseling follow-up |
| `app/cafeteria/{orders,meal-plans,inventory,feedback}` | `useSisStore` | real ordering/payment identity, stock-or-money engine | Cafeteria follow-up |
| `app/activities/{houses,sports,competitions,certificates,awards,analytics}` | `useSisStore` | house/sports/competition models | Activities follow-up |
| `app/activities/events/[id]/{journey,results}` | `db.schoolEvents` (old pre-9U mock) | unreachable from real event detail; hygiene-only gap in guard docs, not a live defect | Activities follow-up (low priority) |
| `app/hostel/{mess,visitors,complaints,maintenance,leave,settings,reports}` | `useSisStore` | mess/complaint/maintenance policy models | Hostel follow-up |
| `app/library/{authors,barcode,categories,digital,publishers,qr,reports,reservations,shelves,stocktake}` | `useSisStore` | reservation queueing, barcode/QR infra, digital-lending rights | Library follow-up |
| `app/transport/{live,attendance,incidents,maintenance,fuel,documents,fees,notifications,reports,settings}` | `useSisStore`/`use-transport` (legacy) | GPS/telemetry, fuel/maintenance logs, transport-fee engine | Transport follow-up |
| `app/inventory/{vendors,purchases}` | `useSisStore` | vendor/PO model | Inventory follow-up |
| `app/assets/{depreciation,disposal}` | `useSisStore` | depreciation schedule/disposal workflow | Assets follow-up |
| `app/accounting/{vendors,purchase-orders,budgets}` | `useSisStore` | no backing API/model exists at all | Accounting follow-up |
| `app/payroll/{loans,tax,advances}` | honest static stub | no lending/statutory-tax/advance policy exists | Payroll follow-up |
| `app/fees/payment-links`, `app/pay/[linkId]` | honest static stub | no payment-gateway integration | Fees follow-up |
| `app/documents/{settings,verification,batch,print-queue}`, `app/id-cards/*` (legacy), `app/letters/*`, `app/admit-cards/*` | `services/documents-service` (mock numbering/generation) | batch/print-queue/verification/QR infra; admit-cards/letters have no template registry | Document Studio follow-up |
| Front Desk sub-pages: `app/front-desk/{gate-passes,calls,deliveries,incidents}` | `useSisStore` | gate-pass/delivery/call-log models | Front Desk follow-up |
| `app/communication/*` (hub, inbox, announcements, broadcasts, notices, groups, templates, parents, calendar, analytics, settings) | `useSisStore` | this was the OLD mock parent-messaging surface; real staff-to-staff messaging already exists at `app/teacher/messages` and was NOT built by migrating this hub (deliberate, see Phase 9K memory) | Would need parent/guardian account foundation first — explicitly out of scope until that exists |

## PARTIALLY REAL / HYBRID

| Surface | Real part | Mock part | Notes |
|---|---|---|---|
| `app/health/page.tsx` (hub) | stat tiles (`useHealthDashboard`) | quicklink descriptions for Medications/Incidents/Appointments/Reports read identically to real links, no visual distinction | Labeling-honesty gap, not a fake-number defect — left as-is this phase |
| `app/library/page.tsx` (hub) | headline stats | quicklinks point at mock sub-pages | Same labeling-honesty gap; navigation only, no fabricated number |
| Main Dashboard | 6 real widgets (Action Inbox, Attendance, Fee Collection, Staff Availability, Timetable, Upcoming Events) | 3 widgets honestly render `<DeferredWidget>` (AI Morning Brief, Campus Overview 3D, Exception Feed, School Pulse) | This is the ONE place `<DeferredWidget>` is actually used — correctly honest |
| `app/notifications/preferences/page.tsx` | permission/channel display | toggle state persisted to `useSisStore`, not DB — "saved" copy is misleading | See fix-candidate #3 in production-readiness.md |

## STILL MOCK — NEEDS MIGRATION (fake data presented as truth with no distinguishing signal at all, beyond a dev comment)

Everything in the INTENTIONALLY DEFERRED table above technically belongs here too
under a strict reading of "MOCK = fake data presented as product truth" (see the
labeling-honesty note in production-readiness.md) — none of it is visibly marked
to an end user. It is listed separately above because it is at least *honestly
tracked in source* and matches previously stated, reviewed scope boundaries. There
is no additional "silent, undocumented" mock surface beyond what both tables above
already list — the repo-wide grep sweep (Phase 9W) found no production file
importing mock authority outside what `route-mock-guard.test.ts` already accounts
for.

**One surface is worse than the rest and called out specifically:** `app/results/*`
(the cross-exam Results hub — `page.tsx`, `class`, `student`, `analytics`,
`publication`) is fully mock (`useSisStore`), presents a fabricated exam
publish/schedule/revoke pipeline, and — unlike most other mock pages in this
codebase — carries **no disclaiming comment pattern visible even to a developer
skimming the file**, and sits one nav-level away from the genuinely real
`/exams/[examId]/results` page, making the fake/real boundary unusually easy to
miss. Recommended: fold this into whatever future phase does the system-wide
UI-labeling pass, treating it as the top-priority page for that pass.

## TEST-ONLY MOCK

- `lib/data/seed/**` — seed-only, used by `prisma db seed` and `.db.test.ts` fixtures. Not reachable from any production route.
- `*.db.test.ts` / `*.test.ts` mock doubles and in-memory fixtures — test-only, never imported by `app/**` or `lib/server/**` production code.

## DEAD MOCK TO DELETE

**None found.** Every mock service/hook/store-slice/type still has at least one
live consumer among the intentionally-deferred pages listed above. The shared mock
store (`lib/hooks/use-store.ts` / `lib/data/store.ts`) has 150+ consumer files
across the app — deleting it is not possible without migrating (not just auditing)
every surface in the two tables above.

## Fixed in Phase 9W (moved from MOCK-leak to REAL)

- `app/transport/page.tsx` — removed fake "documents need attention" banner (was reading mock `vehicleDocuments`/`driverDocuments`), now fully real.
- `app/front-desk/page.tsx` — removed 3 mock-derived stat tiles + mock incident banner from the real visitor hub, now fully real.
- `app/hr/dashboard/page.tsx` — the "Leave" quicklink pointed at the stale mock `/hr/leave` page instead of the real `/attendance/leave` (Phase 9E); repointed.

## Known gap, not fixed this phase

- Visitors and Transport (36 API routes combined) have zero `requireFeature`
  enforcement — no `visitor`/`transport` feature keys exist at all. This predates
  the feature-gating convention introduced around Library (9N). Adding entitlement
  gating to two whole domains has product/pricing implications outside a "small
  fix" — documented for a future phase, not changed here.
- Test-DB tenant-delete orphans (16,453 orphaned student rows, proportionate
  class/section/enrollment orphans) — quantified, not remediated. See
  `production-readiness.md` Database Hygiene section. No production risk (OrgScope
  filters by real tenantId); pure test-cleanup debris. A future phase could add a
  scoped, reviewed one-off cleanup script (delete rows where `tenantId` matches no
  live tenant) run manually against dev only — not something to run unattended.
- `useGradingSchemes` is exported by both `lib/hooks/use-exams.ts` (mock) and
  `lib/hooks/api/use-results-api.ts` (real). Each current consumer imports the
  correct one for its own reality (`app/grading/rules/page.tsx` → mock,
  `app/grading/schemes/page.tsx` → real), so there is no live bug, but the name
  collision is a footgun for a future edit. Not renamed this phase (touches a
  widely-imported hook, larger than a "small fix").
- HR non-core Attendance/Leave/Leave-calendar (`app/hr/attendance`,
  `app/hr/leave`, `app/hr/leave/calendar`) are exact duplicate mock surfaces of
  the already-real `/attendance/staff` and `/attendance/leave` (Phase 9E) — not
  a case of missing infrastructure, just an un-retired old page. Cheapest future
  fix is likely deleting/redirecting these three pages rather than migrating them.
