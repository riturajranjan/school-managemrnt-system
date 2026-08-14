// Development seed — Backend Phases 1 & 2.
//
// Phase 1: core org hierarchy — 1 Tenant → 1 School → 2 Branches → 1 current
//   AcademicSession.
// Phase 2: identity foundation — system Roles, development Users (Argon2id-hashed
//   passwords), TenantMemberships, RoleAssignments, and one explicit PlatformAdmin.
//
// No students/parents/business data. Idempotent (upserts / get-or-create).
// Run via `npm run db:seed` (prisma db seed → `tsx prisma/seed.ts`). Uses its own
// PrismaClient (the app singleton is server-only) and loads env like prisma.config.ts.
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/server/password";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../lib/server/authz/catalog";
import { seedPhase4 } from "./seed-phase4";
import { seedPlans } from "./seed-plans";
import { seedSubscriptions } from "./seed-subscriptions";
import { seedAddonsMarketplace } from "./seed-addons-marketplace";
import { seedAcademics } from "./seed-academics";
import { seedSubjects } from "./seed-subjects";
import { seedAttendance } from "./seed-attendance";
import { seedInvoices } from "./seed-invoices";
import { seedPayments } from "./seed-payments";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set (see .env.local / .env.example).");
}

// Development-only password. Override with SEED_DEMO_PASSWORD if desired.
const DEV_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Novyra@Dev123";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// System roles seeded for the demo tenant's users (item 8).
const SYSTEM_ROLES: { key: string; name: string }[] = [
  { key: "SCHOOL_ADMIN", name: "School Admin" },
  { key: "PRINCIPAL", name: "Principal" },
  { key: "TEACHER", name: "Teacher" },
  { key: "LIBRARIAN", name: "Librarian" },
  { key: "TRANSPORT_MANAGER", name: "Transport Manager" },
  { key: "HR_ADMIN", name: "HR Admin" },
];

/** Get-or-create a system role (null tenantId → not covered by a DB unique). */
async function upsertSystemRole(key: string, name: string) {
  const existing = await prisma.role.findFirst({
    where: { key, tenantId: null, isSystem: true },
  });
  if (existing) return existing;
  return prisma.role.create({
    data: { key, name, isSystem: true, tenantId: null },
  });
}

async function main() {
  // =========================================================================
  // Phase 1 — organization hierarchy
  // =========================================================================
  const tenant = await prisma.tenant.upsert({
    where: { slug: "novyra-demo" },
    update: {},
    create: {
      name: "Novyra Demo Group",
      slug: "novyra-demo",
      status: "ACTIVE",
      timezone: "Asia/Kolkata",
      locale: "en-IN",
      currency: "INR",
    },
  });

  const school = await prisma.school.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "NPS-001" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Novyra Public School",
      shortName: "NPS",
      code: "NPS-001",
      schoolType: "K-12",
      board: "CBSE",
      establishmentYear: 2005,
      email: "office@novyra-demo.example",
      phone: "+91-80-4000-0000",
      website: "https://novyra-demo.example",
      timezone: "Asia/Kolkata",
      locale: "en-IN",
      currency: "INR",
      status: "ACTIVE",
    },
  });

  const mainBranch = await prisma.branch.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "MAIN" } },
    update: {},
    create: {
      schoolId: school.id,
      name: "Main Campus",
      code: "MAIN",
      email: "main@novyra-demo.example",
      phone: "+91-80-4000-0001",
      addressLine1: "1 Campus Road",
      city: "Bengaluru",
      state: "Karnataka",
      country: "IN",
      postalCode: "560001",
      isPrimary: true,
      status: "ACTIVE",
    },
  });

  await prisma.branch.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "NORTH" } },
    update: {},
    create: {
      schoolId: school.id,
      name: "North Campus",
      code: "NORTH",
      email: "north@novyra-demo.example",
      phone: "+91-80-4000-0002",
      addressLine1: "42 North Avenue",
      city: "Bengaluru",
      state: "Karnataka",
      country: "IN",
      postalCode: "560045",
      isPrimary: false,
      status: "SETUP_PENDING",
    },
  });

  const academicSession = await prisma.academicSession.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "2026-27" } },
    update: {},
    create: {
      schoolId: school.id,
      name: "2026–27",
      code: "2026-27",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      status: "ACTIVE",
      isCurrent: true,
    },
  });

  // =========================================================================
  // Phase 2 — identity foundation
  // =========================================================================
  // System roles
  const roles: Record<string, { id: string }> = {};
  for (const { key, name } of SYSTEM_ROLES) {
    roles[key] = await upsertSystemRole(key, name);
  }

  // --- Permission catalog + role → permission mappings (RBAC) -------------
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, description: p.description },
      create: p,
    });
  }
  const permIdByKey = new Map(
    (await prisma.permission.findMany({ select: { id: true, key: true } })).map((p) => [p.key, p.id]),
  );
  for (const [roleKey, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roles[roleKey];
    if (!role) continue;
    for (const permKey of permKeys) {
      const permissionId = permIdByKey.get(permKey);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  const passwordHash = await hashPassword(DEV_PASSWORD);

  /** Create an ACTIVE, email-verified dev user (idempotent by email). */
  async function upsertUser(email: string, name: string) {
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name,
        passwordHash,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordSetupRequired: false,
      },
    });
  }

  /** Give a user a membership in the demo tenant and assign a system role. */
  async function upsertTenantUser(email: string, name: string, roleKey: string) {
    const user = await upsertUser(email, name);
    const membership = await prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      update: {},
      create: { userId: user.id, tenantId: tenant.id, status: "ACTIVE" },
    });
    await prisma.roleAssignment.upsert({
      where: {
        membershipId_roleId: { membershipId: membership.id, roleId: roles[roleKey].id },
      },
      update: {},
      create: { membershipId: membership.id, roleId: roles[roleKey].id },
    });
    return user;
  }

  // Tenant users (each with one system role)
  await upsertTenantUser("admin@novyra-demo.example", "Aarti Admin", "SCHOOL_ADMIN");
  await upsertTenantUser("principal@novyra-demo.example", "Priya Principal", "PRINCIPAL");
  await upsertTenantUser("teacher@novyra-demo.example", "Tarun Teacher", "TEACHER");
  await upsertTenantUser("librarian@novyra-demo.example", "Leela Librarian", "LIBRARIAN");
  await upsertTenantUser("transport@novyra-demo.example", "Tejas Transport", "TRANSPORT_MANAGER");
  await upsertTenantUser("hr@novyra-demo.example", "Hema HR", "HR_ADMIN");

  // Platform admin — explicit platform access, NO tenant membership.
  const platformUser = await upsertUser("platform.admin@novyra.example", "Nova Platform");
  await prisma.platformAdmin.upsert({
    where: { userId: platformUser.id },
    update: {},
    create: { userId: platformUser.id, role: "SUPER_ADMIN", status: "ACTIVE" },
  });

  // =========================================================================
  // Phase 4 — Admissions, Students & Guardians (real business data)
  // =========================================================================
  await seedPhase4(prisma, {
    tenantId: tenant.id,
    schoolId: school.id,
    branchId: mainBranch.id,
    academicSessionId: academicSession.id,
  });

  // =========================================================================
  // Super Admin Phase SA-4A — plan catalog (platform-global)
  // =========================================================================
  await seedPlans(prisma);

  // =========================================================================
  // Super Admin Phase SA-4B — subscriptions on real schools + plans
  // =========================================================================
  await seedSubscriptions(prisma, { tenantId: tenant.id, schoolId: school.id });

  // =========================================================================
  // Super Admin Phase SA-4D — invoices on the real ACTIVE subscription
  // =========================================================================
  await seedInvoices(prisma);

  // =========================================================================
  // Super Admin Phase SA-4E — a real payment settling a seeded invoice
  // =========================================================================
  await seedPayments(prisma);

  // =========================================================================
  // Super Admin Phase SA-4M — Add-on + Marketplace catalogs (platform-global)
  // =========================================================================
  await seedAddonsMarketplace(prisma);

  // =========================================================================
  // Phase 6-pre — real Class/Section/Enrollment derived from seeded Students
  // =========================================================================
  await seedAcademics(prisma, { tenantId: tenant.id, schoolId: school.id, branchId: mainBranch.id, academicSessionId: academicSession.id });

  // =========================================================================
  // Phase 6 — real Subject catalogue + Class↔Subject assignments
  // =========================================================================
  await seedSubjects(prisma, { tenantId: tenant.id, schoolId: school.id, branchId: mainBranch.id, academicSessionId: academicSession.id });

  // =========================================================================
  // Phase 5 — real attendance on the seeded sections/enrollments
  // =========================================================================
  await seedAttendance(prisma, { tenantId: tenant.id, schoolId: school.id, branchId: mainBranch.id, academicSessionId: academicSession.id });

  // -------------------------------------------------------------------------
  const [tenants, schools, branches, sessions, users, memberships, roleCount, assignments, permissions, rolePerms] =
    await Promise.all([
      prisma.tenant.count(),
      prisma.school.count(),
      prisma.branch.count(),
      prisma.academicSession.count(),
      prisma.user.count(),
      prisma.tenantMembership.count(),
      prisma.role.count(),
      prisma.roleAssignment.count(),
      prisma.permission.count(),
      prisma.rolePermission.count(),
    ]);

  console.log("Seed complete:");
  console.log(`  Org:      Tenant=${tenants} School=${schools} Branch=${branches} Session=${sessions}`);
  console.log(`  Identity: User=${users} Membership=${memberships} Role=${roleCount} RoleAssignment=${assignments}`);
  console.log(`  RBAC:     Permission=${permissions} RolePermission=${rolePerms}`);
  console.log(`  Platform: 1 PlatformAdmin (SUPER_ADMIN, no tenant membership)`);
  console.log(`  Dev password: ${process.env.SEED_DEMO_PASSWORD ? "(from SEED_DEMO_PASSWORD)" : `"${DEV_PASSWORD}"`} — development only`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
