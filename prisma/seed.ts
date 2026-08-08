// Production-safe development seed. Idempotent: re-running upserts rather than
// duplicating. Seeds the tenancy + identity + RBAC foundation only — NO business
// module data (no students/fees/exams/etc.).
//
// Run: npm run db:seed  (Node 20+; wired via prisma.config.ts seed command)
//
// Demo credentials come from SEED_DEMO_PASSWORD (see .env.example); a documented
// dev fallback is used if unset. Never commit real credentials.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PERMISSIONS, SYSTEM_ROLES } from "../lib/server/rbac/catalog";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Seed-local auth instance so passwords hash exactly as the login flow expects.
const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET ?? "seed-only-secret-please-override-in-env",
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
});

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Novyra@Dev123";

type DemoUser = {
  email: string;
  name: string;
  phone?: string;
  platformRole?: "SUPER_ADMIN";
  roleKey?: string;
  scopeType?: "ALL_TENANT" | "SCHOOLS" | "BRANCHES";
  schoolCode?: string;
  branchCode?: string;
};

async function ensureUser(u: DemoUser): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: u.email } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { name: u.name, phone: u.phone ?? null, emailVerified: true } });
    return existing.id;
  }
  // signUpEmail creates the User + a credential Account with a correct hash.
  await auth.api.signUpEmail({ body: { email: u.email, password: DEMO_PASSWORD, name: u.name } });
  const created = await prisma.user.findUnique({ where: { email: u.email } });
  if (!created) throw new Error(`Failed to create user ${u.email}`);
  await prisma.user.update({ where: { id: created.id }, data: { phone: u.phone ?? null, emailVerified: true } });
  return created.id;
}

async function main() {
  console.log("Seeding permissions…");
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, description: p.description },
      create: { key: p.key, module: p.module, description: p.description },
    });
  }
  const permByKey = new Map((await prisma.permission.findMany()).map((p) => [p.key, p.id]));

  console.log("Seeding system roles…");
  const roleByKey = new Map<string, string>();
  for (const r of SYSTEM_ROLES) {
    // System roles have tenantId = null; Prisma rejects null in a unique `where`,
    // so match on findFirst then create/update.
    const found = await prisma.role.findFirst({ where: { tenantId: null, key: r.key } });
    const role = found
      ? await prisma.role.update({ where: { id: found.id }, data: { name: r.name, description: r.description, isSystem: true } })
      : await prisma.role.create({ data: { key: r.key, name: r.name, description: r.description, isSystem: true, tenantId: null } });
    roleByKey.set(r.key, role.id);
    // Reset then set this role's permission mappings (idempotent).
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: r.permissions.map((pk) => ({ roleId: role.id, permissionId: permByKey.get(pk)! })),
      skipDuplicates: true,
    });
  }

  console.log("Seeding tenant / school / branches / session…");
  const tenant = await prisma.tenant.upsert({
    where: { slug: "novyra" },
    update: {},
    create: { name: "Novyra Education Group", slug: "novyra", status: "ACTIVE", timezone: "Asia/Kolkata", locale: "en-IN", currency: "INR" },
  });

  const school = await prisma.school.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "NVX-001" } },
    update: {},
    create: { tenantId: tenant.id, name: "Novyra Public School", shortName: "NPS", code: "NVX-001", board: "CBSE", schoolType: "K-12", status: "ACTIVE", timezone: "Asia/Kolkata" },
  });

  const branchMain = await prisma.branch.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "MAIN" } },
    update: {},
    create: { schoolId: school.id, name: "Main Campus", code: "MAIN", city: "Gurugram", state: "Haryana", status: "ACTIVE" },
  });
  await prisma.branch.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "NORTH" } },
    update: {},
    create: { schoolId: school.id, name: "North Wing (Primary)", code: "NORTH", city: "Gurugram", state: "Haryana", status: "ACTIVE" },
  });

  const session = await prisma.academicSession.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "2026-27" } },
    update: {},
    create: {
      schoolId: school.id,
      name: "2026 – 2027",
      code: "2026-27",
      startDate: new Date(Date.UTC(2026, 3, 1)),
      endDate: new Date(Date.UTC(2027, 2, 31)),
      status: "ACTIVE",
      isCurrent: true,
    },
  });
  // Enforce single-current invariant at seed time too.
  await prisma.academicSession.updateMany({ where: { schoolId: school.id, id: { not: session.id }, isCurrent: true }, data: { isCurrent: false } });

  console.log("Seeding demo users, memberships & role assignments…");
  const demoUsers: DemoUser[] = [
    { email: "aditya@novyra.io", name: "Aditya Rao", platformRole: "SUPER_ADMIN" },
    { email: "kavya@novyra.edu.in", name: "Kavya Iyer", roleKey: "SCHOOL_ADMIN", scopeType: "ALL_TENANT" },
    { email: "meera@novyra.edu.in", name: "Dr. Meera Krishnan", roleKey: "PRINCIPAL", scopeType: "SCHOOLS", schoolCode: "NVX-001" },
    { email: "ananya@novyra.edu.in", name: "Ananya Sharma", roleKey: "TEACHER", scopeType: "BRANCHES", schoolCode: "NVX-001", branchCode: "MAIN" },
    { email: "rahul@novyra.edu.in", name: "Rahul Verma", roleKey: "ACCOUNTANT", scopeType: "SCHOOLS", schoolCode: "NVX-001" },
    { email: "priya@novyra.edu.in", name: "Priya Nair", roleKey: "LIBRARIAN", scopeType: "SCHOOLS", schoolCode: "NVX-001" },
    { email: "auditor@novyra.edu.in", name: "Ishaan Bose", roleKey: "AUDITOR", scopeType: "ALL_TENANT" },
  ];

  for (const du of demoUsers) {
    const userId = await ensureUser(du);

    if (du.platformRole) {
      await prisma.platformAdmin.upsert({
        where: { userId },
        update: { role: du.platformRole, status: "ACTIVE" },
        create: { userId, role: du.platformRole, status: "ACTIVE" },
      });
      continue; // platform staff are NOT tenant members
    }

    if (!du.roleKey) continue;

    const membership = await prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId, tenantId: tenant.id } },
      update: { status: "ACTIVE" },
      create: { userId, tenantId: tenant.id, status: "ACTIVE" },
    });

    const roleId = roleByKey.get(du.roleKey)!;
    const schoolId = du.schoolCode === "NVX-001" ? school.id : null;
    const branchId = du.branchCode === "MAIN" ? branchMain.id : null;

    // Clear this membership's assignments for the role, then set the intended scope.
    await prisma.userRoleAssignment.deleteMany({ where: { membershipId: membership.id, roleId } });
    await prisma.userRoleAssignment.create({
      data: {
        membershipId: membership.id,
        roleId,
        scopeType: du.scopeType ?? "ALL_TENANT",
        schoolId: du.scopeType === "ALL_TENANT" ? null : schoolId,
        branchId: du.scopeType === "BRANCHES" ? branchId : null,
      },
    });
  }

  await prisma.auditEvent.create({
    data: { tenantId: tenant.id, action: "seed.completed", entityType: "Seed", metadata: { at: new Date().toISOString() } },
  });

  console.log("\nSeed complete.");
  console.log(`  Platform super admin: aditya@novyra.io`);
  console.log(`  Tenant admin:         kavya@novyra.edu.in`);
  console.log(`  Demo password:        ${process.env.SEED_DEMO_PASSWORD ? "(from SEED_DEMO_PASSWORD)" : DEMO_PASSWORD + "  (dev fallback)"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
