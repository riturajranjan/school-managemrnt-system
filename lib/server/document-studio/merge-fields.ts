// Merge-field registry (Phase 9V) — CRITICAL security boundary. A template's
// `variables` list may only contain these exact allowlisted dotted keys.
// There is NO arbitrary Prisma property-path lookup anywhere in this file —
// every key has its own narrow, explicit resolver. Sensitive fields (health,
// counseling, payroll, bank details) are never registered here at all, so no
// template can ever surface them regardless of who authors it.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { studentDisplayName, staffDisplayName } from "./access";

export type DocSubjectType = "STUDENT" | "STAFF";

type MergeContext = {
  scope: OrgScope;
  subjectType: DocSubjectType;
  studentId?: string;
  staffId?: string;
  achievementId?: string;
};

type MergeFieldDef = {
  key: string;
  label: string;
  subjectTypes: DocSubjectType[];
  resolve: (ctx: MergeContext) => Promise<string | null>;
};

async function currentEnrollment(scope: OrgScope, studentId: string) {
  if (scope.academicSessionId) {
    const inSession = await prisma.enrollment.findFirst({
      where: { studentId, academicSessionId: scope.academicSessionId, status: "ENROLLED" },
      select: { class: { select: { name: true } }, section: { select: { name: true } } },
      orderBy: { enrolledAt: "desc" },
    });
    if (inSession) return inSession;
  }
  return prisma.enrollment.findFirst({
    where: { studentId },
    select: { class: { select: { name: true } }, section: { select: { name: true } } },
    orderBy: { enrolledAt: "desc" },
  });
}

const REGISTRY: MergeFieldDef[] = [
  {
    key: "student.fullName",
    label: "Student name",
    subjectTypes: ["STUDENT"],
    resolve: async (ctx) => {
      const s = await prisma.student.findUnique({ where: { id: ctx.studentId! }, select: { firstName: true, lastName: true } });
      return s ? studentDisplayName(s) : null;
    },
  },
  {
    key: "student.admissionNumber",
    label: "Admission number",
    subjectTypes: ["STUDENT"],
    resolve: async (ctx) => {
      const s = await prisma.student.findUnique({ where: { id: ctx.studentId! }, select: { admissionNumber: true } });
      return s?.admissionNumber ?? null;
    },
  },
  {
    key: "student.class",
    label: "Class & section (current enrollment)",
    subjectTypes: ["STUDENT"],
    resolve: async (ctx) => {
      const e = await currentEnrollment(ctx.scope, ctx.studentId!);
      if (!e) return null;
      return e.section?.name ? `${e.class.name} · ${e.section.name}` : e.class.name;
    },
  },
  {
    key: "academicSession.name",
    label: "Academic session",
    subjectTypes: ["STUDENT", "STAFF"],
    resolve: async (ctx) => {
      if (!ctx.scope.academicSessionId) return null;
      const s = await prisma.academicSession.findUnique({ where: { id: ctx.scope.academicSessionId }, select: { name: true } });
      return s?.name ?? null;
    },
  },
  {
    key: "school.name",
    label: "School name",
    subjectTypes: ["STUDENT", "STAFF"],
    resolve: async (ctx) => {
      const s = await prisma.school.findUnique({ where: { id: ctx.scope.schoolId }, select: { name: true } });
      return s?.name ?? null;
    },
  },
  {
    key: "school.address",
    label: "School address",
    subjectTypes: ["STUDENT", "STAFF"],
    resolve: async (ctx) => {
      const branchId = ctx.scope.branchId;
      if (!branchId) return null;
      const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true } });
      if (!b) return null;
      return [b.addressLine1, b.addressLine2, b.city, b.state, b.postalCode].filter(Boolean).join(", ") || null;
    },
  },
  {
    key: "school.contact",
    label: "School contact",
    subjectTypes: ["STUDENT", "STAFF"],
    resolve: async (ctx) => {
      const school = await prisma.school.findUnique({ where: { id: ctx.scope.schoolId }, select: { phone: true, email: true } });
      if (!school) return null;
      return [school.phone, school.email].filter(Boolean).join(" · ") || null;
    },
  },
  {
    key: "staff.fullName",
    label: "Staff name",
    subjectTypes: ["STAFF"],
    resolve: async (ctx) => {
      const s = await prisma.staff.findUnique({ where: { id: ctx.staffId! }, select: { firstName: true, lastName: true, displayName: true } });
      return s ? staffDisplayName(s) : null;
    },
  },
  {
    key: "staff.employeeCode",
    label: "Employee code",
    subjectTypes: ["STAFF"],
    resolve: async (ctx) => {
      const s = await prisma.staff.findUnique({ where: { id: ctx.staffId! }, select: { employeeCode: true } });
      return s?.employeeCode ?? null;
    },
  },
  {
    key: "staff.designation",
    label: "Designation",
    subjectTypes: ["STAFF"],
    resolve: async (ctx) => {
      const s = await prisma.staff.findUnique({ where: { id: ctx.staffId! }, select: { designation: true } });
      return s?.designation ?? null;
    },
  },
  {
    key: "staff.joiningDate",
    label: "Joining date",
    subjectTypes: ["STAFF"],
    resolve: async (ctx) => {
      const s = await prisma.staff.findUnique({ where: { id: ctx.staffId! }, select: { joiningDate: true } });
      return s?.joiningDate ? s.joiningDate.toISOString().slice(0, 10) : null;
    },
  },
  {
    key: "achievement.title",
    label: "Achievement title (Activity Achievement Certificate only)",
    subjectTypes: ["STUDENT"],
    resolve: async (ctx) => {
      if (!ctx.achievementId) return null;
      const a = await prisma.studentAchievement.findFirst({ where: { id: ctx.achievementId, studentId: ctx.studentId!, schoolId: ctx.scope.schoolId }, select: { title: true } });
      return a?.title ?? null;
    },
  },
];

export function mergeFieldsFor(subjectType: DocSubjectType): { key: string; label: string }[] {
  return REGISTRY.filter((f) => f.subjectTypes.includes(subjectType)).map((f) => ({ key: f.key, label: f.label }));
}

/** Validates that every key in `variables` is a real, allowlisted merge field
 * applicable to `subjectType`. Throws INVALID_MERGE_FIELD on the first bad key
 * — never a silent fake value. */
export function assertKnownMergeFields(subjectType: DocSubjectType, variables: string[]): void {
  const known = new Set(mergeFieldsFor(subjectType).map((f) => f.key));
  for (const key of variables) {
    if (!known.has(key)) throw new HttpError("INVALID_MERGE_FIELD", `Unknown or inapplicable merge field: ${key}`);
  }
}

/** Resolves every variable in `variables` against the real subject. Returns a
 * flat key -> value map (the raw source snapshot). A variable that resolves
 * to null/empty is reported in `unresolved` — callers decide whether that's
 * fatal (a required field) or acceptable. */
export async function resolveMergeFields(ctx: MergeContext, variables: string[]): Promise<{ resolved: Record<string, string>; unresolved: string[] }> {
  assertKnownMergeFields(ctx.subjectType, variables);
  const resolved: Record<string, string> = {};
  const unresolved: string[] = [];
  for (const key of variables) {
    const def = REGISTRY.find((f) => f.key === key)!;
    const value = await def.resolve(ctx);
    if (value == null || value === "") unresolved.push(key);
    else resolved[key] = value;
  }
  return { resolved, unresolved };
}
