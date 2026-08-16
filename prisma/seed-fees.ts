// Phase 9F seed — real FeeCategory rows, one real FeeStructure (with items)
// applied to a real Class, one real StudentFeeAssignment (+ its FeeCharge
// rows) against a real enrolled student, and one real FeePayment against it,
// so the demo has something real to walk through. Idempotent (unique code /
// unique structure name / unique assignment).
import type { PrismaClient } from "../lib/generated/prisma/client";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

export async function seedFees(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, branchId, academicSessionId } = ids;

  const admin = await prisma.roleAssignment.findFirst({
    where: { role: { key: "SCHOOL_ADMIN" }, membership: { tenantId, status: "ACTIVE" } },
    select: { membership: { select: { userId: true } } },
  });
  const targetClass = await prisma.class.findFirst({ where: { schoolId, academicSessionId }, orderBy: { order: "asc" }, select: { id: true, name: true } });
  if (!admin || !targetClass) {
    console.log("  P9F:      skipped (no real SCHOOL_ADMIN or Class yet)");
    return;
  }
  const adminUserId = admin.membership.userId;

  const categoryDefs = [
    { name: "Tuition Fee", code: "TUITION" },
    { name: "Examination Fee", code: "EXAM" },
  ];
  const categories: { id: string; name: string }[] = [];
  for (const c of categoryDefs) {
    const row = await prisma.feeCategory.upsert({
      where: { schoolId_code: { schoolId, code: c.code } },
      create: { tenantId, schoolId, name: c.name, code: c.code },
      update: {},
      select: { id: true, name: true },
    });
    categories.push(row);
  }

  let structure = await prisma.feeStructure.findFirst({ where: { schoolId, academicSessionId, name: `${targetClass.name} — Annual Fee Plan` }, select: { id: true, _count: { select: { items: true } } } });
  if (!structure) {
    structure = await prisma.feeStructure.create({
      data: {
        tenantId, schoolId, branchId, academicSessionId, name: `${targetClass.name} — Annual Fee Plan`, status: "ACTIVE",
        createdByUserId: adminUserId, createdByName: "School Admin",
        classes: { create: [{ classId: targetClass.id }] },
        items: {
          create: [
            { categoryId: categories[0].id, name: "Term 1 Tuition", amount: 15000, dueDate: new Date("2026-06-15"), order: 0 },
            { categoryId: categories[0].id, name: "Term 2 Tuition", amount: 15000, dueDate: new Date("2026-11-15"), order: 1 },
            { categoryId: categories[1].id, name: "Annual Examination Fee", amount: 2000, dueDate: new Date("2026-07-01"), order: 2 },
          ],
        },
      },
      select: { id: true, _count: { select: { items: true } } },
    });
  }

  const student = await prisma.enrollment.findFirst({ where: { schoolId, academicSessionId, classId: targetClass.id, status: "ENROLLED" }, orderBy: { studentId: "asc" }, select: { studentId: true, id: true } });
  let assigned = 0, paid = 0;
  if (student) {
    const existingAssignment = await prisma.studentFeeAssignment.findUnique({ where: { studentId_feeStructureId: { studentId: student.studentId, feeStructureId: structure.id } }, select: { id: true } });
    if (!existingAssignment) {
      const items = await prisma.feeStructureItem.findMany({ where: { feeStructureId: structure.id }, select: { id: true, categoryId: true, category: { select: { name: true } }, name: true, amount: true, dueDate: true } });
      const assignment = await prisma.studentFeeAssignment.create({
        data: { tenantId, schoolId, branchId, academicSessionId, studentId: student.studentId, enrollmentId: student.id, feeStructureId: structure.id, assignedByUserId: adminUserId, assignedByName: "School Admin" },
        select: { id: true },
      });
      await prisma.feeCharge.createMany({
        data: items.map((item) => ({
          tenantId, schoolId, branchId, academicSessionId, assignmentId: assignment.id, studentId: student.studentId, feeStructureItemId: item.id,
          categoryName: item.category.name, itemName: item.name, amount: item.amount, dueDate: item.dueDate,
        })),
      });
      assigned = items.length;

      // Pay off the first (Term 1) charge in full so the demo has a real receipt to view.
      const term1 = await prisma.feeCharge.findFirst({ where: { assignmentId: assignment.id, itemName: "Term 1 Tuition" }, select: { id: true, amount: true } });
      if (term1) {
        const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { code: true, currency: true } });
        await prisma.feeReceiptCounter.upsert({ where: { schoolId }, create: { schoolId, counter: 0 }, update: {} });
        const counterRows = await prisma.$queryRaw<{ counter: number }[]>`UPDATE fee_receipt_counters SET counter = counter + 1 WHERE "schoolId" = ${schoolId} RETURNING counter`;
        const receiptNumber = `RCP-${school.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "SCH"}-2026-${String(counterRows[0].counter).padStart(6, "0")}`;
        const payment = await prisma.feePayment.create({
          data: {
            tenantId, schoolId, branchId, academicSessionId, studentId: student.studentId, receiptNumber, amount: term1.amount, currency: school.currency,
            method: "CASH", paymentDate: new Date("2026-06-10"), receivedByUserId: adminUserId, receivedByName: "School Admin",
          },
          select: { id: true },
        });
        await prisma.feePaymentAllocation.create({ data: { paymentId: payment.id, chargeId: term1.id, amount: term1.amount } });
        paid = 1;
      }
    }
  }

  console.log(`  P9F:      categories(${categories.length}) structure(items=${structure._count.items || 3}) assigned(+${assigned}) payments(+${paid})`);
}
