// Database verification — Backend Phase 1.
//
// Runs real Prisma queries against the configured PostgreSQL database and prints
// row counts and a relationship walk (Tenant → School → Branch) plus the current
// AcademicSession scope. Run via `npm run db:verify`.
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set (see .env.local / .env.example).");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [tenants, schools, branches, sessions] = await Promise.all([
    prisma.tenant.count(),
    prisma.school.count(),
    prisma.branch.count(),
    prisma.academicSession.count(),
  ]);

  console.log("Phase 1 — org row counts:");
  console.log(`  Tenant:          ${tenants}`);
  console.log(`  School:          ${schools}`);
  console.log(`  Branch:          ${branches}`);
  console.log(`  AcademicSession: ${sessions}`);

  // --- Phase 2 identity counts + relationship checks ----------------------
  const [users, memberships, roleCount, assignments, platformAdmins, sessionRows] =
    await Promise.all([
      prisma.user.count(),
      prisma.tenantMembership.count(),
      prisma.role.count(),
      prisma.roleAssignment.count(),
      prisma.platformAdmin.count(),
      prisma.session.count(),
    ]);

  console.log("\nPhase 2 — identity row counts:");
  console.log(`  User:             ${users}`);
  console.log(`  TenantMembership: ${memberships}`);
  console.log(`  Role:             ${roleCount}`);
  console.log(`  RoleAssignment:   ${assignments}`);
  console.log(`  PlatformAdmin:    ${platformAdmins}`);
  console.log(`  Session:          ${sessionRows}`);

  console.log("\nIdentity relationship walk (User → Membership → Tenant → Role):");
  const identityUsers = await prisma.user.findMany({
    orderBy: { email: "asc" },
    include: {
      platformAdmin: true,
      memberships: {
        include: {
          tenant: true,
          roleAssignments: { include: { role: true } },
        },
      },
    },
  });
  for (const u of identityUsers) {
    const hasHash = Boolean(u.passwordHash);
    const hashOk = hasHash && u.passwordHash!.startsWith("$argon2id$");
    if (u.platformAdmin) {
      console.log(
        `  • ${u.email} — PLATFORM ${u.platformAdmin.role}, tenants=${u.memberships.length} (pwd=${hashOk ? "argon2id" : "MISSING"})`,
      );
    }
    for (const m of u.memberships) {
      const roleKeys = m.roleAssignments.map((ra) => ra.role.key).join(", ") || "(none)";
      console.log(
        `  • ${u.email} — ${m.tenant.slug} [${m.status}] roles: ${roleKeys} (pwd=${hashOk ? "argon2id" : "MISSING"})`,
      );
    }
  }

  // Explicit checks the phase asks for.
  const check = async (label: string, ok: boolean) =>
    console.log(`  ${ok ? "PASS" : "FAIL"} — ${label}`);
  console.log("\nSeed relationship checks:");
  const findByEmail = (email: string) => identityUsers.find((u) => u.email === email);
  const admin = findByEmail("admin@novyra-demo.example");
  const principal = findByEmail("principal@novyra-demo.example");
  const teacher = findByEmail("teacher@novyra-demo.example");
  const platform = findByEmail("platform.admin@novyra.example");
  const hasRoleInDemo = (u: typeof admin, key: string) =>
    Boolean(
      u?.memberships.some(
        (m) => m.tenant.slug === "novyra-demo" && m.roleAssignments.some((ra) => ra.role.key === key),
      ),
    );
  await check("School Admin → membership → novyra-demo → SCHOOL_ADMIN role", hasRoleInDemo(admin, "SCHOOL_ADMIN"));
  await check("Principal → same tenant → PRINCIPAL role", hasRoleInDemo(principal, "PRINCIPAL"));
  await check("Teacher → same tenant → TEACHER role", hasRoleInDemo(teacher, "TEACHER"));
  await check(
    "Platform Admin has explicit platform access AND no tenant membership",
    Boolean(platform?.platformAdmin) && platform?.memberships.length === 0,
  );
  await check(
    "No tenant role grants platform access (tenant users have no PlatformAdmin row)",
    [admin, principal, teacher].every((u) => !u?.platformAdmin),
  );
  await check(
    "All seeded users have an Argon2id hash (no plaintext)",
    identityUsers.every((u) => Boolean(u.passwordHash) && u.passwordHash!.startsWith("$argon2id$")),
  );

  console.log("\nRelationship walk (Tenant → School → Branch):");
  const tenantTree = await prisma.tenant.findMany({
    include: {
      schools: {
        include: {
          branches: { orderBy: { code: "asc" } },
          academicSessions: { where: { isCurrent: true } },
        },
      },
    },
  });

  for (const tenant of tenantTree) {
    console.log(`  • ${tenant.name} (${tenant.slug})`);
    for (const school of tenant.schools) {
      console.log(`      └─ ${school.name} [${school.code}]`);
      for (const branch of school.branches) {
        const primary = branch.isPrimary ? " (primary)" : "";
        console.log(`           • ${branch.name} [${branch.code}]${primary} — ${branch.status}`);
      }
      const current = school.academicSessions[0];
      console.log(
        current
          ? `           current session: ${current.name} [${current.code}] — ${current.status}`
          : "           current session: (none)",
      );
    }
  }

  // Invariant check: at most one current session per school.
  const currentBySchool = await prisma.academicSession.groupBy({
    by: ["schoolId"],
    where: { isCurrent: true },
    _count: { _all: true },
  });
  const violations = currentBySchool.filter((row) => row._count._all > 1);
  console.log(
    violations.length === 0
      ? "\nInvariant OK: ≤ 1 current session per school."
      : `\nInvariant VIOLATED: ${violations.length} school(s) have multiple current sessions.`,
  );
}

main()
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
