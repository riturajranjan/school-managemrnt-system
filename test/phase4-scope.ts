// Shared helper for Phase-4 DB-integration tests: resolves the seeded demo
// tenant/school/branch/session + the admin actor into an OrgScope, and probes
// whether the DB is reachable/seeded (tests skip when it isn't).
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";

export type SeededOrg = {
  scope: OrgScope;
  // A second, isolated tenant scope (fabricated tenantId) for isolation tests.
  otherTenantScope: OrgScope;
};

export async function probeSeededScope(): Promise<SeededOrg | null> {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "novyra-demo" }, select: { id: true } });
    if (!tenant) return null;
    const school = await prisma.school.findFirst({
      where: { tenantId: tenant.id, code: "NPS-001" },
      select: { id: true },
    });
    if (!school) return null;
    const branch = await prisma.branch.findFirst({ where: { schoolId: school.id, code: "MAIN" }, select: { id: true } });
    const session = await prisma.academicSession.findFirst({ where: { schoolId: school.id, code: "2026-27" }, select: { id: true } });
    const admin = await prisma.user.findUnique({ where: { email: "admin@novyra-demo.example" }, select: { id: true, name: true } });
    if (!branch || !session || !admin) return null;

    const scope: OrgScope = {
      tenantId: tenant.id,
      schoolId: school.id,
      branchId: branch.id,
      academicSessionId: session.id,
      actor: { id: admin.id, name: admin.name },
    };
    const otherTenantScope: OrgScope = {
      ...scope,
      tenantId: "tenant_does_not_exist",
      actor: { id: admin.id, name: admin.name },
    };
    return { scope, otherTenantScope };
  } catch {
    return null;
  }
}
