# Production Readiness Manifest — Phase 9W

_Generated: 2026-08-23. Baseline: commit `6fcd73e` (development, 2 commits ahead of
origin/development: Activities 9U + Document Studio 9V, not yet pushed)._

This is a system-wide audit, not a new feature phase. Methodology: every `app/**`
route was inventoried; routes were classified by reading the page, its data hooks,
its backing `app/api/**` route, and the `lib/server/**` module underneath, checking
for mock imports, RBAC enforcement, tenant/school/branch isolation, and feature-gate
enforcement. Financial and concurrency claims were verified against the live dev
Postgres (`novyra_sms_dev`) with read-only SQL, not just code inspection. Given the
codebase's size (475 pages, 428 API routes), domain audits were parallelized; the
highest-risk domains (financial consistency, health/counseling privacy tiers,
concurrency invariants) received the deepest verification, while lower-risk static
sub-pages were sampled by grep + spot-read rather than read line-by-line individually.
Where a claim below could not be independently re-verified this pass, it is stated
as inherited from a prior phase's documented completion (see repo memory) rather
than re-asserted as freshly confirmed.

## Legend

- **REAL** — production UI reads a real API, API reads Postgres, no mock fallback,
  RBAC enforced, isolation enforced where applicable, feature gate enforced where
  applicable, refresh doesn't depend on browser storage, real error/empty states.
- **HYBRID** — page contains both real and mock sections.
- **DEFERRED** — intentionally unsupported. See note below on labeling honesty.
- **MOCK** — fake data presented as product truth.
- **BROKEN** — intended real but has a runtime/API defect.

### A note on "DEFERRED" vs "MOCK" labeling

Nearly every intentionally-unmigrated page in this codebase explains its own
deferral only in a **source comment**, not in visible UI. A handful of dashboard
widgets use the real `<DeferredWidget>` component with a visible message; almost
every deferred full-page CRUD surface (library reservations, hostel mess, transport
fuel/incidents, front-desk gate-passes, communication hub, accounting
vendors/purchase-orders, etc.) renders a fully realistic, fully interactive UI with
**no visible "not real yet" signal to the end user** — only a developer-facing
comment. Strictly applying this audit's own definitions, most of what is
conventionally called "intentionally deferred" in this codebase is **MOCK** from an
end-user's point of view (fake data presented as if real), even though it is
honestly tracked in the source and in `route-mock-guard.test.ts`. This report keeps
the existing DEFERRED label where the code and prior-phase intent are honest and
documented, but flags this UI-labeling gap once, here, system-wide, rather than
re-flagging it on every single row below. **Recommendation for a future phase:** a
single shared `<NotYetAvailable>` banner/badge component applied consistently to
every still-mock page and hub quicklink, so the distinction is visible to users and
not just to developers. This is a UI-only, low-risk, but non-trivial (many files)
change — explicitly deferred out of Phase 9W per the "no redesign" / "do not migrate
large surfaces" rules.

---

## Domain matrix

| Domain | Data | API | UI | RBAC | Isolation | Feature gate | Runtime verified | Status |
|---|---|---|---|---|---|---|---|---|
| Super Admin | Postgres | real | real | platform RBAC | platform-level (no tenant) | N/A | inherited (SA-4N) | READY |
| Auth | Postgres (custom Prisma session-cookie auth, NOT Better Auth — verified: `lib/server/auth/tokens.ts`, `SESSION_COOKIE_NAME="novyra_session"`) | real | real | session-based | N/A | N/A | runtime-verified (see Runtime HTTP smoke) | READY |
| Dashboard (Main) | Postgres | real | real | per-widget permission | tenant/school/branch | N/A | spot-checked | READY WITH DEFERRED SUBFEATURES |
| My Day | Postgres | real | real | staff self-service | tenant/school/branch | N/A | spot-checked | READY |
| Academics core (classes/sections/subjects/curriculum/timetable/homework/lesson-plans/calendar) | Postgres | real | real | RBAC | tenant/school/branch/section | N/A | inherited (6/6A/7/9B/9C/9D) | READY, 1 known mock page (class detail) |
| Attendance (student/period/staff/leave) | Postgres | real | real | RBAC + teacher-ownership | tenant/school/branch/section | N/A | inherited (5/7C/9E) | READY |
| Students / Student 360 | Postgres | real | real | per-tab RBAC | tenant/school/branch | N/A | spot-checked | READY (13 real tabs) |
| Teachers/Staff/HR core | Postgres | real | real | hr.view / hr.manage split; payroll gated by `payroll.view`, not `hr.view` (verified: `lib/server/staff/teacher-detail-service.ts` has zero health/counseling references) | tenant/school/branch | N/A | fork-verified (direct reads) | READY, HR non-core (recruitment/onboarding/performance/training/attendance/leave/etc.) fully mock |
| Exams/Marks/Grading/Report Cards/Promotion | Postgres | real | real | marks.enter/verify, promotion.view/manage | tenant/school/branch/section, snapshot-safe | N/A | fork-verified (direct reads) | READY, `exams/[examId]/{students,publish,attendance}` and `marks/import` stay mock |
| Results hub (`app/results/*`, cross-exam) | mock (`useSisStore`) | mock | mock | N/A | N/A | N/A | fork-verified | MOCK — fabricated pipeline, no on-screen disclaimer (see Fix Candidates) |
| Fees | Postgres | real | real | fees.collect/refund | tenant/school/branch | N/A | DB-verified (0 defects) | READY |
| Accounting | Postgres | real | real | RBAC | tenant/school/branch | N/A | DB-verified (0 unbalanced journals) | READY, vendors/POs/budgets mock |
| Payroll | Postgres | real | real | RBAC | tenant/school/branch | N/A | DB-verified (0 defects) | READY, loans/tax/advances honestly deferred |
| Visitors / Front Desk | Postgres | real | real | RBAC (role-key) | tenant/school | **none** (no `visitor` feature key exists) | spot-checked | HYBRID (hub fixed in 9W) |
| Communication | Postgres (staff messaging only) | real | real | RBAC | tenant/school | N/A | inherited (9K) | HYBRID (`/communication/*` hub fully mock, real messaging lives at `/teacher/messages`) |
| Transport | Postgres | real | real | RBAC | tenant/school | **none** (no `transport` feature key exists) | spot-checked, hub fixed in 9W | HYBRID |
| Library | Postgres | real | real | RBAC | tenant/school | `library` enforced | spot-checked | READY WITH DEFERRED SUBFEATURES |
| Inventory / Assets | Postgres | real | real | RBAC | tenant/school | enforced (12/12, 11/11 routes) | spot-checked | READY, vendors/purchases/depreciation/disposal mock |
| Hostel | Postgres | real | real | RBAC | tenant/school | enforced | spot-checked, concurrency confirmed | READY WITH DEFERRED SUBFEATURES |
| Health | Postgres | real | real | health.view/viewSensitive two-tier | tenant/school | enforced | privacy tier confirmed | READY WITH DEFERRED SUBFEATURES |
| Counseling | Postgres | real | real | counseling.view/viewConfidential two-tier, 404-not-403 | tenant/school | enforced | privacy tier confirmed | READY WITH DEFERRED SUBFEATURES |
| Cafeteria | Postgres | real | real | RBAC | tenant/school | enforced | concurrency confirmed | READY WITH DEFERRED SUBFEATURES |
| Activities | Postgres | real | real | RBAC | tenant/school | enforced | spot-checked | READY WITH DEFERRED SUBFEATURES |
| Document Studio | Postgres | real | real | RBAC | tenant/school | enforced | no raw-HTML rendering confirmed | READY WITH DEFERRED SUBFEATURES |

Super Admin row confirmed via direct fork re-reads of `app/api/super-admin/permissions/route.ts`
(`requirePlatformAdmin()`) and `app/api/super-admin/search/route.ts`
(`requireAnyPermission(VIEW_PERMS)`, per-category `authorizedTypes`, fails closed
403 for tenant roles) in addition to the pre-existing `docs/backend/mock-debt.md`
SA-4N baseline.

---

## Fix candidates found and their disposition

| # | Location | Issue | Disposition |
|---|---|---|---|
| 1 | `app/transport/page.tsx` | Real hub rendered a fake "N documents need attention" warning banner sourced from mock `useSisStore` (`vehicleDocuments`/`driverDocuments`), styled identically to real data | **FIXED** — banner and mock import removed; route added to `route-mock-guard.test.ts` MIGRATED_FILES |
| 2 | `app/front-desk/page.tsx` | Real hub mixed 3 mock-derived stat tiles (gate passes/deliveries/call follow-ups) and a mock incident banner into the same visual grid as real visitor stats, no distinction | **FIXED** — mock tiles/banner and mock import removed; route added to `route-mock-guard.test.ts` MIGRATED_FILES |
| 3 | `app/notifications/preferences/page.tsx` | Settings backed by in-memory `useSisStore`, copy claims "saved" but nothing persists past reload | Documented in mock-debt.md; not fixed (real persistence needs a small new model — out of "small fix" scope) |
| 4 | `app/health/medications/page.tsx` | Standalone medication-schedule page is mock (`recordMedication`/`setMedicationStatus`); **verified NOT a documentation contradiction** — `route-mock-guard.test.ts` already correctly states this page "stays mock" (no schedule/dosage-authority engine exists); a fork's initial read of a different, unrelated marker line was a false alarm | No fix needed; correctly classified already |
| 5 | Visitors + Transport feature gating | 0/8 visitor routes and 0/28 transport routes enforce `requireFeature`; no `visitor`/`transport` keys exist in `features-service.ts` at all (unlike every domain built after Library/9N) | Documented as a gap for a future phase — adding feature keys + gating 36 routes is not a "small fix," and changing entitlement behavior without user sign-off on pricing/plan implications would overstep this audit's mandate |
| 6 | Test-DB tenant-delete orphans | Quantified: 3 real tenants, ~20 real students, but 16,453/16,473 student rows (and proportionate class/section/enrollment rows) are orphaned from repeated `*.db.test.ts` cleanup, ~20MB of table bloat in a 103MB DB | Documented only, not remediated — mass-deleting 16k+ rows without a scoped, reviewed script is a destructive action outside this audit's "no mass deletion without explicit certainty" rule; see Database Hygiene section |
| 7 | `app/hr/dashboard/page.tsx:55` | Real HR dashboard's "Leave" button linked to the stale mock `/hr/leave` page instead of the real `/attendance/leave` (Phase 9E) page | **FIXED** — link repointed to `/attendance/leave` |
| 8 | `app/results/*` (`page.tsx`, `class`, `student`, `analytics`, `publication`) | Cross-exam Results hub is fully mock (`useSisStore`) with a fabricated exam pipeline (published/scheduled/revoked statuses) and, unlike some other mock pages in this codebase, **no on-screen disclaimer at all** — most confusing since the per-exam `/exams/[examId]/results` page one level down IS real | Documented in mock-debt.md; not fixed this phase (a labeling-only fix here risks confusing users further without a broader consistent pass — see the system-wide UI-labeling-honesty finding) |
| 9 | `useGradingSchemes` naming collision | `lib/hooks/use-exams.ts` (mock) and `lib/hooks/api/use-results-api.ts` (real) both export a hook of this name; `app/grading/rules/page.tsx` imports the mock one, `app/grading/schemes/page.tsx` imports the real one — no current functional bug, but a footgun for a future edit that imports the wrong one | Documented only, not renamed (renaming a widely-imported hook is a larger, riskier change than this audit's "small fix" scope) |

---

## Database integrity (live queries against `novyra_sms_dev`)

All read-only, all clean, run by the fees/accounting/payroll fork:

- Unbalanced POSTED journals: **0** (443 checked)
- Duplicate `sourceType+sourceId` on journal_entries: **0**
- Duplicate `receiptNumber` on fee_payments: **0**
- Duplicate payroll_payments per `payrollRunId`: **0**
- Negative fee_payments.amount: **0**
- Orphaned `fee_payment_allocations.chargeId` / `fee_payments.studentId`: **0**
- `payroll_payments.amount` vs `payroll_runs.totalNet` mismatch: **0**

Test-DB hygiene (run directly against the same DB, see Database Hygiene section):
tenants=3, students=16,473 (16,453 orphaned), classes=3,831 (3,810 orphaned),
sections=13,769 (13,748 orphaned), enrollments=16,522 (16,506 orphaned). All
orphans are harmless at query time (OrgScope filters by a real tenantId, so an
orphaned row with a stale tenantId never matches a live tenant and is never
returned to any user) — this is purely test-cleanup debris, not a correctness bug.

## Financial consistency

- Fee balance: one canonical formula, `computeCharge()` (`lib/server/fees/balance.ts:33`). No duplicate re-implementation found.
- Journal balance: enforced pre-persist (`lib/server/accounting/journals.ts:106-107`), throws `JOURNAL_NOT_BALANCED` if debits ≠ credits. Immutable once POSTED; corrections only via `reverseJournalEntry` (DB-unique `reversalOfId`).
- Payroll net pay: one function, `summarizeLines()` (`lib/server/payroll/calculation.ts:23-27`). Payment write and its accounting journal post in the same transaction (`payments.ts:56`).
- Money math: DB storage is Decimal-safe throughout; the in-memory derivation layer (`lib/server/fees/money.ts`'s `dec()`) converts to JS `number` with manual cent-rounding before comparison/display. Documented residual risk, not a live correctness bug (values are always rounded to cents before persistence/comparison) — fixing it means plumbing Decimal through display code, out of proportion for this audit.
- Concurrency: fee receipt numbers, journal entry numbers, payroll finalize, payroll pay, refunds — all DB-atomic (`UPDATE...RETURNING` counters, `SELECT...FOR UPDATE` row locks inside `$transaction`, or unique-constraint-derived idempotency). No app-logic-only guard found.

## Privacy tier verification

- **Health**: sensitive fields (reason/notes/vitals/allergies) are nulled server-side unless the caller resolves `health.viewSensitive`; `students.view`/`hr.view` alone never unlock them (`lib/server/health/visits.ts`, `student-profile.ts`).
- **Counseling**: case metadata (`counseling.view`) vs confidential session notes (`counseling.viewConfidential` + counselor-ownership) are two enforced tiers; an ownership mismatch on a confidential note returns 404, not 403, so existence of a case is never confirmed to an unauthorized caller (`lib/server/counseling/access.ts`, `notes.ts`).
- **Staff/Teacher 360**: no salary/payroll exposure under `hr.view` (payroll requires its own permission); no health/counseling leakage under `hr.view`/`students.view`.

## Concurrency invariants (DB-backed, verified)

Fee receipts, accounting journal numbers, payroll finalize/pay, refunds (financial
fork); visitor pass numbers, library accession numbers, transport trip-stop/
trip-student uniqueness (visitors/transport/library fork); hostel bed/session
partial-unique indexes, hostel staff-role partial-unique index, document numbering
(`DocumentNumberCounter`), cafeteria per-slot redemption composite unique index
(hostel/health/cafeteria fork). All confirmed via `schema.prisma`/migration SQL or
`$transaction`/`FOR UPDATE` usage, not test-only assertions.

## Feature entitlement gaps

Library, Hostel, Health, Counseling, Cafeteria, Inventory, Assets all enforce
`requireFeature` server-side. **Visitors and Transport do not** — no feature key
exists for either in `features-service.ts`, and 0 of their combined 36 API routes
call `requireFeature`. This predates the feature-gating convention introduced
around Library (9N); it is a real, documented gap but changing plan/entitlement
behavior for two whole domains without user sign-off is out of this audit's
"small fix" mandate.

## Security / secrets

- No `dangerouslySetInnerHTML`, `eval(`, `new Function`, `$executeRawUnsafe`,
  `$queryRawUnsafe`, or `.innerHTML` found anywhere. All `$executeRaw`/`$queryRaw`
  usage is in atomic-numbering code, parameterized, consistent with the codebase's
  documented "never Math.random() for IDs" convention.
- `.env*` is gitignored; `git ls-files | grep -i env` returns nothing; no committed
  secret found for `DATABASE_URL`/`JWT`/`SESSION_SECRET`/`API_KEY`/`PRIVATE_KEY`.
- One harmless local oddity: an untracked, gitignored `lib/.env.local` containing
  only a placeholder peer-auth `DATABASE_URL` (no password) — not a leak, just
  stray local clutter, not touched.
- Document Studio rendering path is presentational React only — no raw HTML/
  template injection surface (`lib/server/document-studio/content.ts`).

## Test / build gates

- `npx prisma format` / `validate` / `generate` / `migrate status`: all clean, 60 migrations applied, schema up to date.
- `npx tsc --noEmit`: 0 errors.
- `npm run lint`: 0 errors, 15 pre-existing style warnings (React Compiler incompatible-library notices on `react-hook-form.watch()`, a handful of unused-var warnings) — none touched by this phase, none block a merge.
- Full test suite run **twice** (two independent concurrent full runs against the shared dev Postgres, to also validate DB-test parallelism safety): **154/154 files, 1,819/1,819 tests passing**, both times.
- `route-mock-guard.test.ts`: 223/223 assertions passing after this phase's two new guarded files.
