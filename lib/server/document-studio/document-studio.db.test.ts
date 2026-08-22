// Document Studio DB integration tests (Phase 9V). Real Postgres: Template
// CRUD (duplicate code, version bump on ACTIVE content edit, invalid merge
// field/unsafe content rejected, isolation), merge-field registry (Student/
// Staff/School real fields, unknown field rejected, sensitive fields never
// registered), generation (Student/Staff/Achievement, snapshot persisted,
// real concurrency-safe document numbers, archived-template rejected),
// historical safety (Student/Staff/School rename and template edit never
// change an already-generated document), void, RBAC, isolation, audit, DTO
// safety. Namespaced ("T9V"). Mirrors the exact setup/teardown pattern of
// lib/server/activities/activities.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { activateTemplate, archiveTemplate, createTemplate, getTemplate, listTemplates, updateTemplate } from "@/lib/server/document-studio/templates";
import { mergeFieldsFor } from "@/lib/server/document-studio/merge-fields";
import { generateDocument, getGeneratedDocument, previewDocument } from "@/lib/server/document-studio/generate";
import { listGeneratedDocuments, voidDocument } from "@/lib/server/document-studio/documents";
import { getDocumentStudioDashboard } from "@/lib/server/document-studio/dashboard";
import { getStaffGeneratedDocuments, getStudentGeneratedDocuments } from "@/lib/server/document-studio/subject-profile";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9V";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", sectionId = "";
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "", foreignStudentId = "";
let scopeAdmin: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

async function makeStudent(suffix: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE", tid = tenantId, sid = schoolId, bid = branchA, sessId = sessionId): Promise<string> {
  return (await prisma.student.create({
    data: { tenantId: tid, schoolId: sid, branchId: bid, academicSessionId: sessId, admissionNumber: `${NS}-${stamp}-${suffix}`, firstName: suffix, lastName: "T", dateOfBirth: new Date("2012-01-01"), admissionDate: new Date("2024-04-01"), status },
    select: { id: true },
  })).id;
}

const bonafideContent = () => ({
  paperSize: "cert-portrait" as const, orientation: "portrait" as const, accent: "#18b0c8",
  sections: [{ id: "s1", type: "body" as const, label: "Body", show: true, align: "center" as const, fontSize: "sm" as const, fontWeight: "normal" as const, order: 0 }],
  variables: ["student.fullName", "student.admissionNumber", "student.class", "academicSession.name", "school.name"],
});
const idCardContent = () => ({
  paperSize: "cr80" as const, orientation: "landscape" as const, accent: "#18b0c8", style: "premium-teal" as const,
  sections: [{ id: "s1", type: "name" as const, label: "Name", show: true, align: "left" as const, fontSize: "base" as const, fontWeight: "bold" as const, order: 0 }],
  variables: ["student.fullName", "student.admissionNumber", "school.name"],
});
const employmentContent = () => ({
  paperSize: "letter" as const, orientation: "portrait" as const, accent: "#022c43",
  sections: [{ id: "s1", type: "body" as const, label: "Body", show: true, align: "left" as const, fontSize: "sm" as const, fontWeight: "normal" as const, order: 0 }],
  variables: ["staff.fullName", "staff.employeeCode", "staff.designation", "staff.joiningDate", "school.name"],
});
const achievementContent = () => ({
  paperSize: "cert-portrait" as const, orientation: "portrait" as const, accent: "#7c3aed",
  sections: [{ id: "s1", type: "body" as const, label: "Body", show: true, align: "center" as const, fontSize: "sm" as const, fontWeight: "normal" as const, order: 0 }],
  variables: ["student.fullName", "achievement.title", "school.name"],
});

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9v-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} School`, code: `${NS}-${stamp}`, phone: "0124-4000000", email: "office@t9v-demo.test", status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE", addressLine1: "12 Test Road", city: "Gurugram", state: "Haryana", postalCode: "122001" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Class 5", status: "ACTIVE" }, select: { id: true } })).id;
  sectionId = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9v-admin-${stamp}@x.test`, "SCHOOL_ADMIN");

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9v-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchoolId, name: "26-27", code: `${NS}-BS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  foreignStudentId = await makeStudent("foreign", "ACTIVE", foreignTenantId, foreignSchoolId, foreignBranchId, foreignSession);
  foreignAdminUser = await makeUserWithRole(`t9v-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: foreignSession, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.generatedDocument.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.documentNumberCounter.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.documentTemplate.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.studentAchievement.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.enrollment.deleteMany({ where: { schoolId } });
  await prisma.student.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.section.deleteMany({ where: { schoolId } });
  await prisma.class.deleteMany({ where: { schoolId } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.academicSession.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Templates (DB)", () => {
  it("creates a DRAFT template, rejects a duplicate code, and lists by docType", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `BON-${stamp}`, name: "Bonafide", docType: "bonafide-certificate", ...bonafideContent() });
    expect(tpl.status).toBe("draft");
    expect(tpl.subjectType).toBe("student");
    expect(tpl.kind).toBe("student-certificate");

    await expect(createTemplate(scopeAdmin, { code: `BON-${stamp}`, name: "Dup", docType: "bonafide-certificate", ...bonafideContent() })).rejects.toThrow(HttpError);

    const list = await listTemplates(scopeAdmin, { docType: "bonafide-certificate" });
    expect(list.some((t) => t.id === tpl.id)).toBe(true);
  });

  it("rejects a template referencing an unknown merge field", async () => {
    const bad = { ...bonafideContent(), variables: ["student.fullName", "staff.bankAccount"] };
    await expect(createTemplate(scopeAdmin, { code: `BAD-${stamp}`, name: "Bad", docType: "bonafide-certificate", ...bad })).rejects.toThrow(HttpError);
  });

  it("rejects a template with a merge field inapplicable to its subjectType (staff field on a student template)", async () => {
    const bad = { ...bonafideContent(), variables: ["student.fullName", "staff.employeeCode"] };
    await expect(createTemplate(scopeAdmin, { code: `MISMATCH-${stamp}`, name: "Mismatch", docType: "bonafide-certificate", ...bad })).rejects.toThrow(HttpError);
  });

  it("rejects unsafe markup in customText / signatoryName", async () => {
    const bad = { ...bonafideContent(), signatoryName: "<script>alert(1)</script>" };
    await expect(createTemplate(scopeAdmin, { code: `XSS-${stamp}`, name: "XSS", docType: "bonafide-certificate", ...bad })).rejects.toThrow();
  });

  it("activates a template, then bumps version on a content edit while ACTIVE (not while DRAFT)", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `VER-${stamp}`, name: "Versioned", docType: "bonafide-certificate", ...bonafideContent() });
    const draftEdit = await updateTemplate(scopeAdmin, tpl.id, { name: "Versioned (renamed while draft)" });
    expect(draftEdit.version).toBe(1);

    const active = await activateTemplate(scopeAdmin, tpl.id);
    expect(active.status).toBe("active");

    const edited = await updateTemplate(scopeAdmin, tpl.id, { accent: "#ff0000" });
    expect(edited.version).toBe(2);

    const nameOnlyEdit = await updateTemplate(scopeAdmin, tpl.id, { name: "Renamed only" });
    expect(nameOnlyEdit.version).toBe(2);
  });

  it("archives a template; an archived template cannot be edited or reactivated", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `ARC-${stamp}`, name: "Archivable", docType: "bonafide-certificate", ...bonafideContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const archived = await archiveTemplate(scopeAdmin, tpl.id);
    expect(archived.status).toBe("archived");
    await expect(updateTemplate(scopeAdmin, tpl.id, { name: "x" })).rejects.toThrow(HttpError);
    await expect(activateTemplate(scopeAdmin, tpl.id)).rejects.toThrow(HttpError);
  });

  it("isolation: a foreign tenant cannot see or fetch another school's template", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `ISO-${stamp}`, name: "Isolated", docType: "bonafide-certificate", ...bonafideContent() });
    const foreignList = await listTemplates(scopeForeignAdmin);
    expect(foreignList.some((t) => t.id === tpl.id)).toBe(false);
    await expect(getTemplate(scopeForeignAdmin, tpl.id)).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Merge-field registry (DB)", () => {
  it("exposes only real, allowlisted fields per subject type; no sensitive (health/payroll) fields exist", () => {
    const studentFields = mergeFieldsFor("STUDENT").map((f) => f.key);
    const staffFields = mergeFieldsFor("STAFF").map((f) => f.key);
    expect(studentFields).toContain("student.fullName");
    expect(studentFields).toContain("student.class");
    expect(staffFields).toContain("staff.employeeCode");
    expect(staffFields).not.toContain("student.fullName");
    const all = [...studentFields, ...staffFields];
    expect(all.some((k) => /health|payroll|bank|salary|counseling/i.test(k))).toBe(false);
  });
});

describe.skipIf(!dbReady)("Generation (DB)", () => {
  it("generates a real student document with a resolved class from a real Enrollment", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `GENBON-${stamp}`, name: "Gen Bonafide", docType: "bonafide-certificate", ...bonafideContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const student = await makeStudent("gen1");
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId, studentId: student, status: "ENROLLED" } });

    const doc = await generateDocument(scopeAdmin, { templateId: tpl.id, studentId: student });
    expect(doc.status).toBe("generated");
    expect(doc.recipientName).toContain("gen1");
    expect(doc.documentNumber).toMatch(/^BON-/);
    expect("fields" in doc.rendered && doc.rendered.fields.class).toBe("Class 5 · A");
    expect("fields" in doc.rendered && doc.rendered.fields.session).toBe("26-27");
  });

  it("rejects generation for a template that requires class when no enrollment exists", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `NOENR-${stamp}`, name: "No Enrollment", docType: "bonafide-certificate", ...bonafideContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const student = await makeStudent("noenr1");
    await expect(generateDocument(scopeAdmin, { templateId: tpl.id, studentId: student })).rejects.toThrow(HttpError);
  });

  it("preview resolves and renders WITHOUT allocating a document number or persisting", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `PREV-${stamp}`, name: "Preview", docType: "bonafide-certificate", ...bonafideContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const student = await makeStudent("prev1");
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId, studentId: student, status: "ENROLLED" } });
    const before = await prisma.generatedDocument.count({ where: { schoolId } });
    const preview = await previewDocument(scopeAdmin, { templateId: tpl.id, studentId: student });
    expect(preview.unresolved).toEqual([]);
    expect("fields" in preview.rendered && preview.rendered.number).toBeUndefined();
    const after = await prisma.generatedDocument.count({ where: { schoolId } });
    expect(after).toBe(before);
  });

  it("rejects generation against a DRAFT or ARCHIVED template", async () => {
    const draft = await createTemplate(scopeAdmin, { code: `DRAFTGEN-${stamp}`, name: "Draft", docType: "bonafide-certificate", ...bonafideContent() });
    const student = await makeStudent("draftgen1");
    await expect(generateDocument(scopeAdmin, { templateId: draft.id, studentId: student })).rejects.toThrow(HttpError);

    const archived = await createTemplate(scopeAdmin, { code: `ARCGEN-${stamp}`, name: "Arc", docType: "bonafide-certificate", ...bonafideContent() });
    await activateTemplate(scopeAdmin, archived.id);
    await archiveTemplate(scopeAdmin, archived.id);
    await expect(generateDocument(scopeAdmin, { templateId: archived.id, studentId: student })).rejects.toThrow(HttpError);
  });

  it("rejects a foreign, inactive, or nonexistent student", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `INVSUBJ-${stamp}`, name: "Inv", docType: "bonafide-certificate", ...bonafideContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const inactive = await makeStudent("inactivegen", "INACTIVE");
    await expect(generateDocument(scopeAdmin, { templateId: tpl.id, studentId: inactive })).rejects.toThrow(HttpError);
    await expect(generateDocument(scopeAdmin, { templateId: tpl.id, studentId: foreignStudentId })).rejects.toThrow(HttpError);
    await expect(generateDocument(scopeAdmin, { templateId: tpl.id, studentId: "nonexistent" })).rejects.toThrow(HttpError);
  });

  it("generates a real staff employment certificate", async () => {
    const staff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-EMP1-${stamp}`, firstName: "Employee", lastName: "One", designation: "Teacher", joiningDate: new Date("2020-06-01"), status: "ACTIVE" }, select: { id: true } });
    const tpl = await createTemplate(scopeAdmin, { code: `EMP-${stamp}`, name: "Employment", docType: "employment-certificate", ...employmentContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const doc = await generateDocument(scopeAdmin, { templateId: tpl.id, staffId: staff.id });
    expect(doc.subjectType).toBe("staff");
    expect("fields" in doc.rendered && doc.rendered.fields.designation).toBe("Teacher");
    expect("fields" in doc.rendered && doc.rendered.fields.joiningDate).toBe("2020-06-01");
  });

  it("generates a real student ID card (kind=id-card, rendered as IdCardRecord)", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `SID-${stamp}`, name: "Student ID", docType: "student-id", ...idCardContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const student = await makeStudent("idcard1");
    const doc = await generateDocument(scopeAdmin, { templateId: tpl.id, studentId: student });
    expect("cardNumber" in doc.rendered).toBe(true);
    expect(doc.documentNumber).toMatch(/^ID-STU-/);
  });

  it("generates a real activity achievement certificate from a real StudentAchievement, and rejects an achievement belonging to another student", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `ACH-${stamp}`, name: "Achievement", docType: "achievement-certificate", ...achievementContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const student = await makeStudent("ach1");
    const otherStudent = await makeStudent("ach2");
    const achievement = await prisma.studentAchievement.create({ data: { tenantId, schoolId, studentId: student, title: "Won inter-school quiz", awardedAt: new Date("2027-01-01"), createdByUserId: adminUser }, select: { id: true } });

    await expect(generateDocument(scopeAdmin, { templateId: tpl.id, studentId: otherStudent, achievementId: achievement.id })).rejects.toThrow(HttpError);

    const doc = await generateDocument(scopeAdmin, { templateId: tpl.id, studentId: student, achievementId: achievement.id });
    expect("fields" in doc.rendered && doc.rendered.fields.eventName).toBe("Won inter-school quiz");
  });

  it("isolation: a foreign tenant cannot see or fetch another school's generated document", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `GENISO-${stamp}`, name: "Gen Isolation", docType: "bonafide-certificate", ...bonafideContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const student = await makeStudent("geniso1");
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId, studentId: student, status: "ENROLLED" } });
    const doc = await generateDocument(scopeAdmin, { templateId: tpl.id, studentId: student });
    const foreignList = await listGeneratedDocuments(scopeForeignAdmin);
    expect(foreignList.some((d) => d.id === doc.id)).toBe(false);
    await expect(getGeneratedDocument(scopeForeignAdmin, doc.id)).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Document numbering (DB)", () => {
  it("is unique per document and concurrency-safe under a generation race", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `RACE-${stamp}`, name: "Race", docType: "bonafide-certificate", ...bonafideContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const students = await Promise.all(Array.from({ length: 8 }, (_, i) => makeStudent(`race${i}`)));
    await Promise.all(students.map((s) => prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId, studentId: s, status: "ENROLLED" } })));

    const results = await Promise.all(students.map((s) => generateDocument(scopeAdmin, { templateId: tpl.id, studentId: s })));
    const numbers = results.map((r) => r.documentNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

describe.skipIf(!dbReady)("Historical safety (DB)", () => {
  it("a generated document's rendered snapshot survives Student rename, School rename, and template content edit", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `HIST-${stamp}`, name: "Historical", docType: "bonafide-certificate", ...bonafideContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const student = await makeStudent("hist1");
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId, studentId: student, status: "ENROLLED" } });
    const doc = await generateDocument(scopeAdmin, { templateId: tpl.id, studentId: student });
    const originalName = doc.recipientName;
    const originalSchoolName = "fields" in doc.rendered ? doc.rendered.schoolName : undefined;

    await prisma.student.update({ where: { id: student }, data: { firstName: "RenamedAfterIssue" } });
    await prisma.school.update({ where: { id: schoolId }, data: { name: "Renamed School Name" } });
    await updateTemplate(scopeAdmin, tpl.id, { accent: "#000000" });

    const reread = await getGeneratedDocument(scopeAdmin, doc.id);
    expect(reread.recipientName).toBe(originalName);
    expect("fields" in reread.rendered ? reread.rendered.schoolName : undefined).toBe(originalSchoolName);
    expect("fields" in reread.rendered ? reread.rendered.accent : undefined).toBe("#18b0c8");
    expect(reread.templateVersion).toBe(1);
  });
});

describe.skipIf(!dbReady)("Void (DB)", () => {
  it("voids a generated document with a required reason; double void is rejected; snapshot remains readable", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `VOID-${stamp}`, name: "Voidable", docType: "bonafide-certificate", ...bonafideContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const student = await makeStudent("void1");
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId, studentId: student, status: "ENROLLED" } });
    const doc = await generateDocument(scopeAdmin, { templateId: tpl.id, studentId: student });

    await expect(voidDocument(scopeAdmin, doc.id, { reason: "" })).rejects.toThrow();
    const voided = await voidDocument(scopeAdmin, doc.id, { reason: "Issued in error" });
    expect(voided.status).toBe("void");
    expect(voided.voidReason).toBe("Issued in error");
    await expect(voidDocument(scopeAdmin, doc.id, { reason: "again" })).rejects.toThrow(HttpError);

    const stillReadable = await getGeneratedDocument(scopeAdmin, doc.id);
    expect(stillReadable.rendered).toBeTruthy();
  });
});

describe.skipIf(!dbReady)("Dashboard & Student/Staff 360 (DB)", () => {
  it("dashboard is DB-derived from real records", async () => {
    const dashboard = await getDocumentStudioDashboard(scopeAdmin);
    expect(dashboard.activeTemplates).toBeGreaterThanOrEqual(1);
    expect(dashboard.studentDocuments).toBeGreaterThanOrEqual(1);
  });

  it("Student 360 and Staff 360 return real generated-document history", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `S360-${stamp}`, name: "S360", docType: "bonafide-certificate", ...bonafideContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const student = await makeStudent("s360doc1");
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId, studentId: student, status: "ENROLLED" } });
    const doc = await generateDocument(scopeAdmin, { templateId: tpl.id, studentId: student });

    const profile = await getStudentGeneratedDocuments(scopeAdmin, student);
    expect(profile.some((d) => d.id === doc.id)).toBe(true);

    const staff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-S360STF-${stamp}`, firstName: "S360", lastName: "Staff", designation: "Clerk", joiningDate: new Date("2021-01-01"), status: "ACTIVE" }, select: { id: true } });
    const staffTpl = await createTemplate(scopeAdmin, { code: `S360EMP-${stamp}`, name: "S360 Employment", docType: "employment-certificate", ...employmentContent() });
    await activateTemplate(scopeAdmin, staffTpl.id);
    const staffDoc = await generateDocument(scopeAdmin, { templateId: staffTpl.id, staffId: staff.id });
    const staffProfile = await getStaffGeneratedDocuments(scopeAdmin, staff.id);
    expect(staffProfile.some((d) => d.id === staffDoc.id)).toBe(true);
  });
});

describe.skipIf(!dbReady)("Security / RBAC / Audit / DTO safety (DB)", () => {
  it("documents.view/generate/manageTemplates/void: SCHOOL_ADMIN has all; PRINCIPAL/HR_ADMIN generate but not manageTemplates/void; TEACHER has view only", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("documents.manageTemplates");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("documents.void");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("documents.generate");
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain("documents.manageTemplates");
    expect(ROLE_PERMISSIONS.HR_ADMIN).toContain("documents.generate");
    expect(ROLE_PERMISSIONS.HR_ADMIN).not.toContain("documents.manageTemplates");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("documents.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("documents.generate");
  });

  it("template and generation mutations are audited", async () => {
    const events = await prisma.auditEvent.count({
      where: { tenantId, action: { in: ["DOCUMENT_TEMPLATE_CREATED", "DOCUMENT_TEMPLATE_ACTIVATED", "DOCUMENT_TEMPLATE_ARCHIVED", "DOCUMENT_GENERATED", "DOCUMENT_VOIDED"] } },
    });
    expect(events).toBeGreaterThan(5);
  });

  it("DTOs never leak tenantId/schoolId and never contain audit metadata with the full rendered body", async () => {
    const tpl = await createTemplate(scopeAdmin, { code: `DTO-${stamp}`, name: "DTO", docType: "bonafide-certificate", ...bonafideContent() });
    await activateTemplate(scopeAdmin, tpl.id);
    const student = await makeStudent("dto1");
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId, studentId: student, status: "ENROLLED" } });
    const doc = await generateDocument(scopeAdmin, { templateId: tpl.id, studentId: student });
    const raw = JSON.stringify(doc);
    expect(raw).not.toContain(tenantId);
    expect(raw).not.toContain(schoolId);

    const auditRow = await prisma.auditEvent.findFirst({ where: { tenantId, action: "DOCUMENT_GENERATED", entityId: doc.id } });
    expect(auditRow).toBeTruthy();
    const metaRaw = JSON.stringify(auditRow?.metaJson ?? {});
    expect(metaRaw).not.toContain("recipientName");
    expect(metaRaw.length).toBeLessThan(500);
  });
});
