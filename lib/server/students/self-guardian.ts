// Student self-service — "Add / Invite My Guardian" (User Account Creation
// Foundation review, section 3). Deliberately NOT the generic provisioning
// surface: STUDENT holds zero permissions by design (see catalog.ts), so
// this is gated purely by identity — Student.userId === caller, resolved
// server-side — never a client-supplied studentId. A student can:
//   - link/create a guardian for THEMSELVES only
// A student can NEVER, through this endpoint:
//   - create a guardian for another student (no studentId is ever accepted)
//   - browse all guardians (no list/search here)
//   - change another student's guardian links
//   - create a staff account or assign an arbitrary role (the role is always
//     hardcoded to GUARDIAN — a zero-permission identity — never chosen)
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import type { OrgScope } from "@/lib/server/api/scope";
import { guardianCreateSchema, linkGuardianToStudent } from "@/lib/server/guardians/service";
import { provisionGuardian } from "@/lib/server/users/provisioning";

const addMyGuardianSchema = z.object({
  guardian: guardianCreateSchema,
  relation: z.enum(["father", "mother", "guardian"]).default("guardian"),
  // Only meaningful when guardian.email is also given — a plain "Add" never
  // creates a login, only an explicit "Invite" does.
  invite: z.boolean().optional(),
});

export type AddMyGuardianResult = { guardianId: string; passwordSetupUrl: string | null };

/** Resolve the caller's OWN Student record — the only authority for `studentId` here. */
async function requireMyStudentId(scope: OrgScope, callerUserId: string): Promise<string> {
  const student = await prisma.student.findFirst({
    where: { userId: callerUserId, schoolId: scope.schoolId },
    select: { id: true },
  });
  if (!student) throw new HttpError("NOT_FOUND", "No student account is linked to this login");
  return student.id;
}

export async function addMyGuardian(scope: OrgScope, callerUserId: string, raw: unknown): Promise<AddMyGuardianResult> {
  const input = parseInput(addMyGuardianSchema, raw);
  if (input.invite && !input.guardian.email) {
    throw new HttpError("VALIDATION_ERROR", "An email is required to invite your guardian to set up a login");
  }
  const studentId = await requireMyStudentId(scope, callerUserId);

  const linkResult = await linkGuardianToStudent(scope, studentId, { guardian: input.guardian, relation: input.relation });
  await recordAudit(prisma, scope, "GUARDIAN_INVITED_BY_STUDENT", "Student", studentId, { guardianId: linkResult.guardianId });

  let passwordSetupUrl: string | null = null;
  if (input.invite && input.guardian.email) {
    const guardianRole = await prisma.role.findFirstOrThrow({ where: { key: "GUARDIAN", isSystem: true }, select: { id: true } });
    const result = await provisionGuardian(scope, guardianRole.id, linkResult.guardianId, input.guardian.email, undefined);
    passwordSetupUrl = result.passwordSetupUrl;
  }

  return { guardianId: linkResult.guardianId, passwordSetupUrl };
}
