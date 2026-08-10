// Student bulk-import DB-integration tests (Backend Phase 4.1). Namespaced
// ("T41-" / "@t41.test") records removed in afterAll.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { probeSeededScope, type SeededOrg } from "@/test/phase4-scope";
import { HttpError } from "@/lib/server/api/guard";
import { MAX_IMPORT_ROWS, importStudents } from "@/lib/server/students/import-service";

const org = await probeSeededScope();
const PREFIX = "T41-";

async function cleanup() {
  if (!org) return;
  const students = await prisma.student.findMany({
    where: { OR: [{ admissionNumber: { startsWith: PREFIX } }, { firstName: { startsWith: "Imp41" } }] },
    select: { id: true },
  });
  const ids = students.map((s) => s.id);
  if (ids.length) {
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.student.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.guardian.deleteMany({ where: { email: { endsWith: "@t41.test" } } });
}

function row(n: number, over: Record<string, unknown> = {}) {
  return {
    admissionNumber: `${PREFIX}${n}`,
    firstName: `Imp41${n}`,
    lastName: "Import",
    dateOfBirth: "2014-06-15",
    gender: "male",
    classLabel: "Grade 4",
    sectionLabel: "A",
    guardian: { firstName: "Papa", lastName: "Import", phone: "+91-9000000001", email: `g${n}@t41.test`, relation: "father" },
    ...over,
  };
}

describe.skipIf(!org)("student bulk import (DB)", () => {
  const o = org as SeededOrg;
  beforeAll(cleanup);
  afterAll(cleanup);

  it("imports a valid batch: creates students, org scope, guardians, timeline, audit", async () => {
    const res = await importStudents(o.scope, { students: [row(1), row(2), row(3)] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.imported).toBe(3);
    expect(res.studentIds.length).toBe(3);

    const first = await prisma.student.findFirstOrThrow({
      where: { schoolId: o.scope.schoolId, admissionNumber: `${PREFIX}1` },
      include: { guardians: true, timeline: true },
    });
    expect(first.tenantId).toBe(o.scope.tenantId);
    expect(first.branchId).toBe(o.scope.branchId);
    expect(first.academicSessionId).toBe(o.scope.academicSessionId);
    expect(first.guardians.length).toBe(1);
    expect(first.timeline.some((t) => t.type === "ADMITTED")).toBe(true);
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: first.id, action: "STUDENT_CREATED" } });
    expect(audit).not.toBeNull();
  });

  it("generates admission numbers when omitted", async () => {
    const res = await importStudents(o.scope, {
      students: [row(0, { admissionNumber: undefined, firstName: "Imp41Gen" })],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const s = await prisma.student.findUniqueOrThrow({ where: { id: res.studentIds[0] } });
    expect(s.admissionNumber).toMatch(/^STU-/);
  });

  it("rejects duplicate admission numbers within the file (imports nothing)", async () => {
    const res = await importStudents(o.scope, { students: [row(10), row(10)] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.details.some((d) => d.field === "admissionNumber" && /within the file/.test(d.message))).toBe(true);
    // Concurrency-safe: assert none of THIS batch's rows were created.
    const created = await prisma.student.count({ where: { schoolId: o.scope.schoolId, admissionNumber: `${PREFIX}10` } });
    expect(created).toBe(0);
  });

  it("rejects admission numbers already present in the school (imports nothing)", async () => {
    await importStudents(o.scope, { students: [row(20)] }); // seed one
    const res = await importStudents(o.scope, { students: [row(20)] }); // same number again
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.details.some((d) => d.field === "admissionNumber" && /already exists/.test(d.message))).toBe(true);
  });

  it("is all-or-nothing: a single invalid row blocks the whole batch", async () => {
    const res = await importStudents(o.scope, {
      students: [row(30), row(31, { dateOfBirth: "not-a-date" }), row(32)],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.details.some((d) => d.field === "dateOfBirth")).toBe(true);
    // Concurrency-safe: the two VALID rows in this batch must not have been created.
    const created = await prisma.student.count({
      where: { schoolId: o.scope.schoolId, admissionNumber: { in: [`${PREFIX}30`, `${PREFIX}32`] } },
    });
    expect(created).toBe(0);
  });

  it("reports row-level errors for missing required fields", async () => {
    const res = await importStudents(o.scope, { students: [row(40, { firstName: "" })] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.details.some((d) => d.row === 1 && d.field === "firstName")).toBe(true);
  });

  it("enforces the max-row limit", async () => {
    const many = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => row(1000 + i));
    await expect(importStudents(o.scope, { students: many })).rejects.toMatchObject({ code: "TOO_MANY_ROWS" });
  });

  it("rejects an empty payload", async () => {
    await expect(importStudents(o.scope, { students: [] })).rejects.toBeInstanceOf(HttpError);
  });

  it("does not import into another tenant (scope is server-assigned)", async () => {
    // Even though the row carries no org fields, the created student belongs to
    // the caller's scope — a different tenant sees none of them.
    const res = await importStudents(o.scope, { students: [row(50)] });
    expect(res.ok).toBe(true);
    const otherCount = await prisma.student.count({ where: { tenantId: o.otherTenantScope.tenantId, admissionNumber: `${PREFIX}50` } });
    expect(otherCount).toBe(0);
  });
});
