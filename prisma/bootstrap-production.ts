// Production bootstrap — system data ONLY, no demo business data.
//
// This is a separate script from prisma/seed.ts (which stays the
// development/demo seed and is never run in production). It initializes the
// minimum an already-migrated production database needs before a human can
// operate it: the system Role catalog, the Permission catalog + RolePermission
// mappings from lib/server/authz/catalog.ts, and exactly one Platform Super
// Admin. It creates no Tenant, School, Branch, AcademicSession, or any
// downstream business/demo data — schools are created afterwards by the real
// Super Admin console, not by seeding.
//
// Idempotent: safe to run more than once (upserts / get-or-create throughout).
// Run explicitly via `npm run db:bootstrap:production` — never wired into
// install/build/deploy.
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/server/password";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../lib/server/authz/catalog";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

// ---------------------------------------------------------------------------
// Production guard — this script must never run by accident against a
// development/demo database, and never silently against production either.
// ---------------------------------------------------------------------------

const CONFIRM_VALUE = "YES_I_UNDERSTAND";
if (process.env.BOOTSTRAP_PRODUCTION_CONFIRM !== CONFIRM_VALUE) {
  console.error(
    `Refusing to run: set BOOTSTRAP_PRODUCTION_CONFIRM="${CONFIRM_VALUE}" to confirm you intend to bootstrap this database.`,
  );
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set (see .env.example).");
}

// Best-effort refusal of obvious local/demo targets. Not a substitute for the
// explicit confirm flag above — just a second guardrail against pointing this
// at a dev database by mistake.
const LOCAL_DB_PATTERNS = [/localhost/i, /127\.0\.0\.1/, /novyra_sms_dev/i];
if (LOCAL_DB_PATTERNS.some((re) => re.test(connectionString))) {
  console.error(
    "Refusing to run: DATABASE_URL looks like a local/development database. " +
      "This script is for production only.",
  );
  process.exit(1);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is required (see .env.example).`);
  }
  return value.trim();
}

const SUPER_ADMIN_EMAIL_RAW = requireEnv("BOOTSTRAP_SUPER_ADMIN_EMAIL");
const SUPER_ADMIN_PASSWORD = requireEnv("BOOTSTRAP_SUPER_ADMIN_PASSWORD");
const SUPER_ADMIN_NAME = requireEnv("BOOTSTRAP_SUPER_ADMIN_NAME");

// Same normalization the real login path applies (trim + lowercase) — see
// lib/server/auth/service.ts `authenticateWithPassword`.
const SUPER_ADMIN_EMAIL = SUPER_ADMIN_EMAIL_RAW.trim().toLowerCase();

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// System roles — the exact real system-role keys the auth/authz architecture
// expects (RoleAssignment/TenantMembership target these; see prisma/seed.ts).
const SYSTEM_ROLES: { key: string; name: string }[] = [
  { key: "SCHOOL_ADMIN", name: "School Admin" },
  { key: "PRINCIPAL", name: "Principal" },
  { key: "VICE_PRINCIPAL", name: "Vice Principal" },
  { key: "TEACHER", name: "Teacher" },
  { key: "LIBRARIAN", name: "Librarian" },
  { key: "TRANSPORT_MANAGER", name: "Transport Manager" },
  { key: "HR_ADMIN", name: "HR Admin" },
  { key: "COUNSELOR", name: "Counselor" },
  { key: "CAFETERIA_MANAGER", name: "Cafeteria Manager" },
  { key: "ACTIVITY_COORDINATOR", name: "Activity Coordinator" },
  { key: "STAFF", name: "Staff" },
  { key: "STUDENT", name: "Student" },
  { key: "GUARDIAN", name: "Guardian" },
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
  // System roles
  // =========================================================================
  const roles: Record<string, { id: string }> = {};
  for (const { key, name } of SYSTEM_ROLES) {
    roles[key] = await upsertSystemRole(key, name);
  }

  // =========================================================================
  // Permission catalog + role → permission mappings (RBAC) — reused verbatim
  // from lib/server/authz/catalog.ts, never duplicated here.
  // =========================================================================
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

  // =========================================================================
  // Initial Platform Super Admin — platform namespace only, no
  // TenantMembership/RoleAssignment (that would put a platform operator inside
  // a tenant, which the real architecture never does for platform admins).
  // =========================================================================
  const passwordHash = await hashPassword(SUPER_ADMIN_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      passwordHash,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      passwordSetupRequired: false,
    },
    create: {
      email: SUPER_ADMIN_EMAIL,
      name: SUPER_ADMIN_NAME,
      passwordHash,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      passwordSetupRequired: false,
    },
  });

  await prisma.platformAdmin.upsert({
    where: { userId: user.id },
    update: { role: "SUPER_ADMIN", status: "ACTIVE" },
    create: { userId: user.id, role: "SUPER_ADMIN", status: "ACTIVE" },
  });

  // =========================================================================
  // Report — no secrets, no password hashes.
  // =========================================================================
  const [roleCount, permissionCount, rolePermCount, tenantCount, schoolCount] = await Promise.all([
    prisma.role.count({ where: { isSystem: true, tenantId: null } }),
    prisma.permission.count(),
    prisma.rolePermission.count(),
    prisma.tenant.count(),
    prisma.school.count(),
  ]);

  console.log("Production bootstrap completed");
  console.log(`Super Admin user ensured: ${SUPER_ADMIN_EMAIL}`);
  console.log(`  System roles:     ${roleCount}`);
  console.log(`  Permissions:      ${permissionCount} (catalog has ${PERMISSIONS.length})`);
  console.log(`  RolePermissions:  ${rolePermCount}`);
  console.log(`  Tenants (should reflect only pre-existing data): ${tenantCount}`);
  console.log(`  Schools (should reflect only pre-existing data): ${schoolCount}`);
}

main()
  .catch((error) => {
    console.error("Production bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
