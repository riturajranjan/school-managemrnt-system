// Admissions service DB-integration tests (Backend Phase 4) — pipeline workflow
// and the critical convert-to-student transaction. Created applications and any
// students they convert into are tracked and removed in afterAll.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { probeSeededScope, type SeededOrg } from "@/test/phase4-scope";
import {
  addApplicationNote,
  changeStage,
  convertApplication,
  createApplication,
  getApplicationDetail,
  updateApplication,
} from "@/lib/server/admissions/service";
import { getStudentDetail } from "@/lib/server/students/service";

const org = await probeSeededScope();
const createdAppIds: string[] = [];

afterAll(async () => {
  if (!org) return;
  if (createdAppIds.length) {
    const students = await prisma.student.findMany({ where: { sourceApplicationId: { in: createdAppIds } }, select: { id: true } });
    const studentIds = students.map((s) => s.id);
    if (studentIds.length) {
      await prisma.auditEvent.deleteMany({ where: { entityId: { in: studentIds } } });
      await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    }
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: createdAppIds } } });
    await prisma.admissionApplication.deleteMany({ where: { id: { in: createdAppIds } } });
  }
  await prisma.guardian.deleteMany({ where: { email: { endsWith: "@t4a.test" } } });
});

async function newApplication(n: number, withGuardian = true) {
  const o = org as SeededOrg;
  const app = await createApplication(o.scope, {
    firstName: "Applicant",
    lastName: `Case${n}`,
    dateOfBirth: "2013-03-03",
    gender: "male",
    appliedClass: "Grade 3",
    source: "website",
    guardians: withGuardian
      ? [{ firstName: "App", lastName: `Parent${n}`, email: `parent${n}@t4a.test`, relation: "father", isPrimary: true }]
      : undefined,
  });
  createdAppIds.push(app.id);
  return app;
}

describe.skipIf(!org)("admissions service (DB)", () => {
  const o = org as SeededOrg;

  it("creates an application with an initial stage-history entry", async () => {
    const app = await newApplication(1);
    expect(app.applicationNumber).toMatch(/^ADM-/);
    expect(app.stage).toBe("new-enquiry");
    const detail = await getApplicationDetail(o.scope, app.id);
    expect(detail.stageHistory.length).toBeGreaterThanOrEqual(1);
    expect(detail.stageHistory.at(-1)?.toStage).toBe("new-enquiry");
  });

  it("updates an application and adds a note", async () => {
    const app = await newApplication(2);
    const updated = await updateApplication(o.scope, app.id, { priority: "high", appliedClass: "Grade 4" });
    expect(updated.priority).toBe("high");
    expect(updated.appliedClass).toBe("Grade 4");
    const note = await addApplicationNote(o.scope, app.id, { body: "Called the parent." });
    expect(note.body).toBe("Called the parent.");
  });

  it("moves through stages and records history + timestamps", async () => {
    const app = await newApplication(3);
    const reviewed = await changeStage(o.scope, app.id, { stage: "under-review", reason: "Screening" });
    expect(reviewed.stage).toBe("under-review");
    expect(reviewed.submittedAt).not.toBeNull();
    const approved = await changeStage(o.scope, app.id, { stage: "approved" });
    expect(approved.stage).toBe("approved");
    const detail = await getApplicationDetail(o.scope, app.id);
    expect(detail.approvedAt).not.toBeNull();
    expect(detail.stageHistory.some((h) => h.toStage === "approved")).toBe(true);
  });

  it("rejects an invalid stage transition (cannot manually move to enrolled)", async () => {
    const app = await newApplication(4);
    await expect(changeStage(o.scope, app.id, { stage: "enrolled" })).rejects.toMatchObject({ code: "INVALID_STAGE_TRANSITION" });
  });

  it("refuses to convert an application that is not approved", async () => {
    const app = await newApplication(5);
    await expect(convertApplication(o.scope, app.id, {})).rejects.toMatchObject({ code: "INVALID_STAGE_TRANSITION" });
  });

  it("converts an approved application into a student (guardians + docs transferred) in one transaction", async () => {
    const app = await newApplication(6);
    // Give the application a document to verify metadata transfer on conversion.
    await prisma.admissionDocument.create({
      data: { applicationId: app.id, type: "birth-certificate", displayName: "Birth Certificate", status: "uploaded", verificationStatus: "VERIFIED" },
    });
    await changeStage(o.scope, app.id, { stage: "approved" });
    const result = await convertApplication(o.scope, app.id, {});
    expect(result.studentId).toBeTruthy();

    // Application is now ENROLLED and points at the student.
    const detail = await getApplicationDetail(o.scope, app.id);
    expect(detail.stage).toBe("enrolled");
    expect(detail.convertedStudentId).toBe(result.studentId);
    expect(detail.enrolledAt).not.toBeNull();

    // Student carries the source application, both timeline events, and the guardian.
    const student = await getStudentDetail(o.scope, result.studentId);
    expect(student.sourceApplicationId).toBe(app.id);
    expect(student.timeline.some((e) => e.type === "ADMISSION_CONVERTED")).toBe(true);
    expect(student.guardians.length).toBeGreaterThanOrEqual(1);
    expect(student.documents.length).toBeGreaterThanOrEqual(1); // transferred admission docs
  });

  it("prevents duplicate conversion of the same application", async () => {
    const app = await newApplication(7);
    await changeStage(o.scope, app.id, { stage: "approved" });
    await convertApplication(o.scope, app.id, {});
    await expect(convertApplication(o.scope, app.id, {})).rejects.toMatchObject({ code: "ALREADY_ENROLLED" });
  });

  it("rolls back the whole conversion when the admission number collides (atomic)", async () => {
    // Seed a student with a known admission number, then try to convert using it.
    const clashNumber = `T4A-CLASH-${Date.now()}`;
    const branchId = o.scope.branchId ?? "";
    const academicSessionId = o.scope.academicSessionId ?? "";
    const existing = await prisma.student.create({
      data: {
        tenantId: o.scope.tenantId,
        schoolId: o.scope.schoolId,
        branchId,
        academicSessionId,
        admissionNumber: clashNumber,
        firstName: "Existing",
        lastName: "Clash",
        dateOfBirth: new Date("2012-01-01"),
        admissionDate: new Date(),
      },
      select: { id: true },
    });
    try {
      const app = await newApplication(8);
      await changeStage(o.scope, app.id, { stage: "approved" });
      await expect(convertApplication(o.scope, app.id, { admissionNumber: clashNumber })).rejects.toMatchObject({
        code: "DUPLICATE_ADMISSION_NUMBER",
      });
      // Nothing committed: the application is still APPROVED, not converted.
      const detail = await getApplicationDetail(o.scope, app.id);
      expect(detail.stage).toBe("approved");
      expect(detail.convertedStudentId).toBeNull();
      const converted = await prisma.student.count({ where: { sourceApplicationId: app.id } });
      expect(converted).toBe(0);
    } finally {
      await prisma.auditEvent.deleteMany({ where: { entityId: existing.id } });
      await prisma.student.delete({ where: { id: existing.id } });
    }
  });
});
