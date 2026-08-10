// Guardian service DB-integration tests (Backend Phase 4). Namespaced records
// ("T4G-" / "@t4g.test") removed in afterAll.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { probeSeededScope, type SeededOrg } from "@/test/phase4-scope";
import { createStudent } from "@/lib/server/students/service";
import {
  createGuardian,
  getGuardian,
  linkGuardianToStudent,
  listGuardians,
  unlinkGuardianFromStudent,
  updateGuardian,
} from "@/lib/server/guardians/service";

const org = await probeSeededScope();
const SPREFIX = "T4G-";

async function cleanup() {
  if (!org) return;
  const students = await prisma.student.findMany({ where: { admissionNumber: { startsWith: SPREFIX } }, select: { id: true } });
  const ids = students.map((s) => s.id);
  if (ids.length) {
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.student.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.guardian.deleteMany({ where: { email: { endsWith: "@t4g.test" } } });
}

async function scratchStudent(n: number) {
  const o = org as SeededOrg;
  const s = await createStudent(o.scope, {
    admissionNumber: `${SPREFIX}${n}-${Date.now()}`,
    firstName: "Link",
    lastName: `Child${n}`,
    dateOfBirth: "2015-01-01",
    gender: "female",
  });
  return s.id;
}

describe.skipIf(!org)("guardian service (DB)", () => {
  const o = org as SeededOrg;
  beforeAll(cleanup);
  afterAll(cleanup);

  it("creates a guardian and rejects a duplicate email (conservative dedup)", async () => {
    const g = await createGuardian(o.scope, { firstName: "Uni", lastName: "Que", email: "unique@t4g.test" });
    expect(g.fullName).toBe("Uni Que");
    await expect(createGuardian(o.scope, { firstName: "Other", lastName: "Person", email: "unique@t4g.test" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updates a guardian", async () => {
    const g = await createGuardian(o.scope, { firstName: "Edit", lastName: "Me", email: "edit@t4g.test" });
    const updated = await updateGuardian(o.scope, g.id, { occupation: "Teacher", phone: "+91-9000000000" });
    expect(updated.occupation).toBe("Teacher");
    expect(updated.phone).toBe("+91-9000000000");
  });

  it("links an existing guardian to a student and prevents a duplicate link", async () => {
    const studentId = await scratchStudent(1);
    const g = await createGuardian(o.scope, { firstName: "Link", lastName: "Exist", email: "linkexist@t4g.test" });
    const link = await linkGuardianToStudent(o.scope, studentId, { guardianId: g.id, relation: "guardian" });
    expect(link.guardianId).toBe(g.id);
    await expect(linkGuardianToStudent(o.scope, studentId, { guardianId: g.id })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("creates + links a new guardian inline, then unlinks it", async () => {
    const studentId = await scratchStudent(2);
    const link = await linkGuardianToStudent(o.scope, studentId, {
      guardian: { firstName: "Inline", lastName: "Guardian", email: "inline@t4g.test" },
      relation: "mother",
      isPrimary: true,
    });
    const detail = await getGuardian(o.scope, link.guardianId);
    expect(detail.children.some((c) => c.student.id === studentId)).toBe(true);

    const res = await unlinkGuardianFromStudent(o.scope, studentId, link.guardianId);
    expect(res.success).toBe(true);
    const after = await getGuardian(o.scope, link.guardianId);
    expect(after.children.some((c) => c.student.id === studentId)).toBe(false);
  });

  it("supports one guardian linked to multiple children", async () => {
    const child1 = await scratchStudent(3);
    const child2 = await scratchStudent(4);
    const g = await createGuardian(o.scope, { firstName: "Shared", lastName: "Parent", email: "shared@t4g.test" });
    await linkGuardianToStudent(o.scope, child1, { guardianId: g.id, relation: "father" });
    await linkGuardianToStudent(o.scope, child2, { guardianId: g.id, relation: "father" });
    const detail = await getGuardian(o.scope, g.id);
    expect(detail.children.length).toBe(2);
  });

  it("supports one student with multiple guardians and a single enforced primary", async () => {
    const studentId = await scratchStudent(5);
    const g1 = await createGuardian(o.scope, { firstName: "Dad", lastName: "Multi", email: "dad.multi@t4g.test" });
    const g2 = await createGuardian(o.scope, { firstName: "Mom", lastName: "Multi", email: "mom.multi@t4g.test" });
    await linkGuardianToStudent(o.scope, studentId, { guardianId: g1.id, relation: "father", isPrimary: true });
    await linkGuardianToStudent(o.scope, studentId, { guardianId: g2.id, relation: "mother", isPrimary: true });
    const primaries = await prisma.studentGuardian.count({ where: { studentId, isPrimary: true } });
    expect(primaries).toBe(1); // second primary demotes the first
  });

  it("lists guardians with pagination + search", async () => {
    const res = await listGuardians(o.scope, { page: 1, pageSize: 5, search: "@t4g.test" });
    expect(res.meta.pageSize).toBe(5);
    expect(res.data.length).toBeLessThanOrEqual(5);
  });
});
