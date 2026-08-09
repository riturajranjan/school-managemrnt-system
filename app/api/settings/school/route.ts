import { prisma } from "@/lib/db/prisma";
import { HttpError, handle, requirePermission, requireSchoolAccess } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";

// GET /api/settings/school — the active school's profile. Demonstrates the full
// authorization pattern: requireAuth → requirePermission("settings.view") →
// school-scope ownership → Prisma → response. (Teacher role lacks settings.view.)
export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("settings.view");
    if (!ctx.schoolId) throw new HttpError("NOT_FOUND", "No school selected");
    await requireSchoolAccess(ctx, ctx.schoolId); // defence in depth (never trust stored id blindly)
    const school = await prisma.school.findUnique({
      where: { id: ctx.schoolId },
      select: {
        id: true,
        name: true,
        shortName: true,
        code: true,
        schoolType: true,
        board: true,
        email: true,
        phone: true,
        website: true,
        timezone: true,
        locale: true,
        currency: true,
        status: true,
      },
    });
    if (!school) throw new HttpError("NOT_FOUND", "School not found");
    return ok(school);
  });
}
