// Shared platform helper (SA-4L): resolve a target School to its real identity +
// tenant, SERVER-SIDE. Features / Domains / Branding all operate on an arbitrary
// school chosen by a platform admin — the tenant is ALWAYS derived here from the
// real School row, never trusted from the browser. Throws NOT_FOUND if the
// school does not exist.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";

export type SchoolTarget = { schoolId: string; tenantId: string; name: string; status: string };

export async function resolveSchoolTarget(schoolId: string): Promise<SchoolTarget> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, tenantId: true, name: true, status: true },
  });
  if (!school) throw new HttpError("NOT_FOUND", "School not found");
  return { schoolId: school.id, tenantId: school.tenantId, name: school.name, status: school.status };
}
