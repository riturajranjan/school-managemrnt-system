# Novyra Campus OS — Backend Architecture (Phase 16 Foundation)

This document describes the production-grade backend foundation established in
Phase 16: multi-tenancy, identity, membership, roles/permissions, access scope,
platform-admin separation, request context, services, validation, transactions,
errors, audit, and the migration/seed workflow.

**Out of scope (intentionally):** business modules (students, admissions,
attendance, timetable, exams, results, fees, transport, library, HR,
communication, hostel, health, activities, documents). These remain on the
existing client mock layer until integrated module-by-module in later phases.

---

## 1. Domain hierarchy

```
Platform (PlatformAdmin)         ← platform staff, OUTSIDE tenant membership
        │
      Tenant                     ← the customer / SaaS account
        │
      School                     ← an institution within a tenant
        │
      Branch                     ← a physical campus of a school
        │
   AcademicSession               ← school-scoped session (e.g. 2026–27)
```

A **Tenant is not a School.** A tenant may own one or many schools; a school has
one or many branches. This mirrors the product's existing SaaS model
(`lib/types/saas.ts`, `lib/types/auth.ts`).

## 2. Tenant model

`Tenant` — `id`, `name`, `slug` (globally unique), `status` (`TenantStatus`),
`timezone`/`locale`/`currency` defaults, timestamps, `archivedAt`. Statuses:
`TRIAL, ACTIVE, PAST_DUE, SUSPENDED, INACTIVE, ARCHIVED`. SaaS billing data is
**not** duplicated here in Phase 16.

## 3. School / Branch / Academic session

- **School** — core org info (`code`, `board`, `schoolType`, affiliation/
  registration numbers, contact, status). Branding/display config lives in a
  separate `SchoolSettings` one-to-one to avoid one giant table.
- **Branch** — belongs to a school; address + contact + timezone override.
- **AcademicSession** — **school-scoped** (shared across a school's branches),
  not branch-scoped. Rationale: an academic calendar is normally common to a
  school; a branch is an operational campus. The **single current session per
  school** invariant is enforced at the service layer
  (`academic-session.service.ts` → `setCurrentSession`, in a transaction),
  because a partial-unique DB constraint doesn't express it cleanly in Prisma.

## 4. User identity

One central identity system — **no** per-persona login tables. Better Auth owns
`User`, `Session`, `Account`, `Verification`. `User` is extended with `phone`,
`status` (`UserStatus`), `lastLoginAt` (all nullable/defaulted so Better Auth's
create path is unaffected). Domain profiles (student/staff/etc.) will later
reference `User.id` where a login is required.

## 5. Membership

`TenantMembership` links `User ↔ Tenant` with a `status`
(`INVITED/ACTIVE/SUSPENDED/REVOKED`) and is unique per `(userId, tenantId)`. A
user can belong to multiple tenants over time — tenantId is **not** a column on
`User`. Role assignments hang off the membership.

## 6. Role / permission architecture

```
Role ──< RolePermission >── Permission
  │
  └──< UserRoleAssignment >── TenantMembership   (+ access scope)
```

- **Permission** — a global catalog keyed by dot-notation (`school.create`,
  `fees.collect`, …), grouped by `module`.
- **Role** — system roles (`isSystem = true`, `tenantId = null`) act as global
  templates; custom roles are tenant-scoped. Role key is unique per tenant.
- **RolePermission** — many-to-many mapping.
- **UserRoleAssignment** — assigns a role to a membership, optionally narrowed
  by an access scope (school/branch).

Seeded foundation roles: `SCHOOL_ADMIN, PRINCIPAL, ACADEMIC_COORDINATOR,
TEACHER, ACCOUNTANT, HR_ADMIN, LIBRARIAN, TRANSPORT_MANAGER, RECEPTIONIST,
PARENT, STUDENT, AUDITOR`. The catalog lives in
`lib/server/rbac/catalog.ts` and is the single source of truth for the seed and
the authorization tests. It is a **foundation slice**, not the full ~250-item
frontend matrix (`lib/permissions/roles.ts`); later phases extend the DB catalog.

## 7. Access scope

`UserRoleAssignment.scopeType` (`AccessScopeType`) + optional `schoolId`/
`branchId` express: `ALL_TENANT`, `SCHOOLS`, `BRANCHES`, and `OWN` today;
`CLASSES/SECTIONS/SUBJECTS` are reserved enum values for later module phases. The
pure checks (`canAccessSchool`, `canAccessBranch`) live in `lib/server/authz.ts`.

## 8. Platform Super Admin separation

Platform staff are represented by a dedicated **`PlatformAdmin`** row keyed by
`userId` with a `PlatformRole` (`PLATFORM_OWNER, SUPER_ADMIN, BILLING_ADMIN,
SUPPORT_ADMIN, CUSTOMER_SUCCESS, AUDITOR`). **Platform access never flows through
`TenantMembership`.** A tenant `SCHOOL_ADMIN` is not, and cannot become, a
platform admin. `SUPER_ADMIN` is deliberately **absent** from the tenant system
roles. Guard: `requirePlatformAdmin()` / `requirePlatformRole()`.

## 9. Request context (tenant isolation — critical)

`RequestContext` (`lib/server/authz.ts`):

```ts
{ userId, tenantId, membershipId, schoolId?, branchId?, academicSessionId?,
  roleKeys, permissions: Set<string>, scopes: AccessScope[], platformRole? }
```

`resolveContext(selector)` (`lib/server/context.ts`) is the **only** place
client-supplied tenant/school/branch ids are trusted — and only after they are
validated against real membership and scope. It:

1. requires a Better Auth session (`requireUser`),
2. loads the `(userId, tenantId)` membership — **denies if not an active
   member** (defeats tenant-id spoofing),
3. resolves roles → permissions → scopes,
4. validates any selected school/branch/session belongs to the tenant AND is in
   scope (`assertSchoolAccess` / `assertBranchAccess`).

**Rule:** never run `prisma.<tenantModel>.findMany()` without a tenant filter
derived from the context. Services take `ctx` and scope every query by
`ctx.tenantId`.

## 10. Server context & guards (server-only)

`getCurrentUser`, `requireUser`, `resolveContext`, `getPlatformRole`
(`context.ts`); `requirePermission`, `requireAnyPermission`,
`requirePlatformRole`, `requirePlatformAdmin` (`permissions.ts`). All are
`server-only`. Prefer `requirePermission(ctx, "student.view")` over inline
`if (role === …)` checks.

## 11. Data access layer

```
lib/db/prisma.ts                 ← dev-safe Prisma 7 singleton (pg adapter)
lib/generated/prisma/*           ← generated client (git-ignored, regenerated)
lib/server/
  errors.ts        authz.ts      context.ts       permissions.ts
  audit.ts         tx.ts         datetime.ts      prisma-errors.ts
  rbac/catalog.ts  validation/*  services/*
```

Server Components, Server Actions, and Route Handlers call **services**; core
logic never lives in UI components. Prisma is a **server-only** singleton cached
on `globalThis` to survive hot reload without exhausting connections. Prisma 7
connects through a **driver adapter** (`@prisma/adapter-pg`), not a built-in
engine URL.

## 12. Validation

Zod, in three layers: client **form** schemas (existing, `lib/schemas/*`),
server **input** schemas (`lib/server/validation/*`), and **domain** rules in
services. Every write re-validates server-side; client validation is never
trusted.

## 13. Transactions

`runInTransaction(fn)` (`lib/server/tx.ts`) threads a `Prisma.TransactionClient`
into services (and `recordAudit`) so multi-write workflows commit atomically.
Established now; future workflows (admission→student, payment→receipt→ledger,
promotion, result publication) will use it. `setCurrentSession` is the first
example.

## 14. Error handling

Typed `AppError` hierarchy (`lib/server/errors.ts`): `ValidationError`,
`AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`,
`BusinessRuleError`. `toErrorResponse()` maps any throwable to a safe
`{ status, body }` — unknown/DB errors collapse to a generic `INTERNAL` message.
`mapPrismaError()` maps Prisma `P2002`→`ConflictError`, `P2025`→`NotFoundError`.
DB internals are never returned to the client.

## 15. Money

**Integer minor units** (paise/cents), matching the existing frontend
(`priceMinor`/`amountMinor`, `lib/finance/money.ts`). When a monetary column is
added to the schema in a finance phase, use Prisma `Decimal` for
ledger/statement precision or integer minor units for transactional amounts —
**never** JS floating point. No finance schema is created in Phase 16.

## 16. Timezone / date-time

Store instants as UTC `DateTime` (Postgres `timestamptz`). Store each
school/branch IANA timezone; convert for display at the edge
(`effectiveTimezone`: branch → school → tenant → default `Asia/Kolkata`).
Academic date-only values (session start/end, DOB) use `@db.Date`. Never persist
formatted date strings as domain dates. Helpers in `lib/server/datetime.ts`.

## 17. Soft delete / archival

Not a blanket `deletedAt`. Categories: **archivable** org records
(`Tenant/School/Branch` carry `status` + `archivedAt`); **immutable/append-only**
history (`AuditEvent`); financial/audit records later are reversed, never
deleted. Only safe config records may be hard-deletable.

## 18. Audit foundation

`AuditEvent` — `tenantId?, actorUserId?, action, entityType, entityId?,
metadata (Json), ipAddress?, createdAt`, append-only, indexed by
`(tenantId, createdAt)` and `(entityType, entityId)`. Write via
`recordAudit(input, tx?)`. **Never** log secrets in `metadata`. Not every model
is audited yet — the framework is established.

## 19. Conventions

- **IDs:** `cuid()` everywhere — non-sequential, URL-safe, no row-count leak; no
  sequential integer ids exposed.
- **Naming:** PascalCase models, camelCase fields, singular model names; enums
  kept short and meaningful.
- **Uniqueness:** tenant `slug` global; school `code` per tenant; branch `code`
  per school; academic session `code` per school; user `email` global (identity);
  role `key` per tenant (system roles enforced at seed/service level since SQL
  NULLs are distinct).
- **Indexes:** membership `(tenantId)`/`(userId)`, school `(tenantId)`, branch
  `(schoolId)`, session `(schoolId)`/`(schoolId, isCurrent)`, permission `key`,
  role-permission `(permissionId)`, assignment `(membershipId)`/`(roleId)`,
  audit `(tenantId, createdAt)`. No speculative per-field indexes.

## 20. Authentication (Better Auth)

Email + password only in Phase 16 (`lib/auth/auth.ts`, mounted at
`/api/auth/[...all]`). Secure hashing is built in; passwords/hashes are never
returned or logged; invalid-login responses are generic. Simulated UI features
(OTP, 2FA, trusted devices, SSO) remain frontend-only until a later phase adds
the matching plugins. Browser client: `lib/auth/client.ts`.

## 21. Route protection

`middleware.ts` performs an **optimistic** session-cookie check and redirects
anonymous users to `/login` (public auth routes and `/api/auth` are exempt). It
is **not** the authorization boundary — real checks are server-side via
`resolveContext` + guards. Enforcement is ON by default; `AUTH_ENFORCED=false`
disables it for local pre-database UI review only.

## 22. Mock ↔ real boundary

UI consumes stable typed **view models** and does not know whether data came
from the mock store or the database. Migration path per module:
`features/<x>/data/mock.ts` → `lib/server/services/<x>.service.ts` behind the
same view-model shape. Phase 16 migrates **no** business module.

## 23. Migration & seed workflow

- **Dev:** `npm run db:migrate` (`prisma migrate dev`) then `npm run db:seed`,
  or `npm run db:setup` for both. Requires Node **20+**.
- **Prod:** `npm run db:migrate:deploy` (`prisma migrate deploy`) — never auto-
  reset a production-like database; `db push` is not the production strategy.
- **Client:** `npm run db:generate`. **Studio:** `npm run db:studio`.
- Config: `prisma.config.ts` (URL/migrations/seed); URL from `DIRECT_URL ??
  DATABASE_URL`.

## 24. Future module integration order (recommended)

Identity/org (done) → **Students & guardians** → Academics (classes/subjects/
sections) → Attendance → Timetable → Exams/Results → Fees/Finance → Transport →
Library → HR/Payroll → Communication → Campus services → Activities → Documents.
Each module: DB models → service layer (tenant-scoped, guarded, validated) →
swap the mock adapter behind the existing view models.
