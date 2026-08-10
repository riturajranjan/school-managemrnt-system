// Student service DB-integration tests (Backend Phase 4). Run against the seeded
// dev database; skipped when it is unreachable/unseeded. All records created here
// are namespaced ("T4S-") and removed in afterAll (cascades handle children).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { probeSeededScope, type SeededOrg } from "@/test/phase4-scope";
import { HttpError } from "@/lib/server/api/guard";
import { archiveStudent, createStudent, getStudentDetail, listStudents, updateStudent } from "@/lib/server/students/service";

const org = await probeSeededScope();
const PREFIX = "T4S-";

async function cleanup() {
  if (!org) return;
  const students = await prisma.student.findMany({ where: { admissionNumber: { startsWith: PREFIX } }, select: { id: true } });
  const ids = students.map((s) => s.id);
  if (ids.length) {
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.student.deleteMany({ where: { id: { in: ids } } }); // cascades docs/timeline/links
  }
  await prisma.guardian.deleteMany({ where: { email: { endsWith: "@t4s.test" } } });
}

describe.skipIf(!org)("student service (DB)", () => {
  const o = org as SeededOrg;
  beforeAll(cleanup);
  afterAll(cleanup);

  function baseInput(n: number) {
    return {
      admissionNumber: `${PREFIX}${n}`,
      firstName: "Test",
      lastName: `Student${n}`,
      dateOfBirth: "2014-05-10",
      gender: "male" as const,
      classLabel: "Grade 5",
      sectionLabel: "A",
    };
  }

  it("creates a student, assigns scope, and records an ADMITTED timeline + audit event", async () => {
    const created = await createStudent(o.scope, baseInput(1));
    expect(created.admissionNumber).toBe(`${PREFIX}1`);
    expect(created.status).toBe("active");
    expect(created.branchId).toBe(o.scope.branchId);
    expect(created.academicSessionId).toBe(o.scope.academicSessionId);

    const detail = await getStudentDetail(o.scope, created.id);
    expect(detail.timeline.some((e) => e.type === "ADMITTED")).toBe(true);

    const audit = await prisma.auditEvent.findFirst({ where: { entityId: created.id, action: "STUDENT_CREATED" } });
    expect(audit).not.toBeNull();
  });

  it("rejects a duplicate admission number within the school", async () => {
    await expect(createStudent(o.scope, baseInput(1))).rejects.toMatchObject({ code: "DUPLICATE_ADMISSION_NUMBER" });
  });

  it("creates a student with inline guardians and links them", async () => {
    const created = await createStudent(o.scope, {
      ...baseInput(2),
      guardians: [
        { firstName: "Papa", lastName: "Test", email: "papa@t4s.test", relation: "father", isPrimary: true },
        { firstName: "Mama", lastName: "Test", email: "mama@t4s.test", relation: "mother" },
      ],
    });
    const detail = await getStudentDetail(o.scope, created.id);
    expect(detail.guardians.length).toBe(2);
    expect(detail.guardians.some((g) => g.link.isPrimary)).toBe(true);
  });

  it("updates a student and records a PROFILE_UPDATED timeline event", async () => {
    const created = await createStudent(o.scope, baseInput(3));
    const updated = await updateStudent(o.scope, created.id, { firstName: "Renamed", house: "Blue" });
    expect(updated.firstName).toBe("Renamed");
    expect(updated.house).toBe("Blue");
    const detail = await getStudentDetail(o.scope, created.id);
    expect(detail.timeline.some((e) => e.type === "PROFILE_UPDATED")).toBe(true);
  });

  it("archives a student (soft delete) and refuses to archive twice", async () => {
    const created = await createStudent(o.scope, baseInput(4));
    const archived = await archiveStudent(o.scope, created.id);
    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).not.toBeNull();
    await expect(archiveStudent(o.scope, created.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("lists with pagination, search and status filter", async () => {
    await createStudent(o.scope, baseInput(5));
    const page1 = await listStudents(o.scope, { page: 1, pageSize: 2, search: PREFIX });
    expect(page1.data.length).toBeLessThanOrEqual(2);
    expect(page1.meta.total).toBeGreaterThanOrEqual(4);
    expect(page1.meta.pageSize).toBe(2);

    const archivedOnly = await listStudents(o.scope, { page: 1, pageSize: 50, search: PREFIX, status: ["archived"] });
    expect(archivedOnly.data.every((s) => s.status === "archived")).toBe(true);
  });

  it("enforces tenant isolation: another tenant cannot read or list these students", async () => {
    const created = await createStudent(o.scope, baseInput(6));
    await expect(getStudentDetail(o.otherTenantScope, created.id)).rejects.toBeInstanceOf(HttpError);
    const otherList = await listStudents(o.otherTenantScope, { page: 1, pageSize: 50, search: PREFIX });
    expect(otherList.data.length).toBe(0);
  });

  it("enforces school isolation: a different school in the same tenant sees none of them", async () => {
    // Create a scratch school in the same tenant and query under its scope.
    const school = await prisma.school.create({
      data: { tenantId: o.scope.tenantId, name: "Scratch School", code: `T4S-SCH-${Date.now()}`, status: "ACTIVE" },
      select: { id: true },
    });
    try {
      const otherSchoolScope = { ...o.scope, schoolId: school.id };
      const list = await listStudents(otherSchoolScope, { page: 1, pageSize: 50, search: PREFIX });
      expect(list.data.length).toBe(0);
    } finally {
      await prisma.school.delete({ where: { id: school.id } });
    }
  });
});
