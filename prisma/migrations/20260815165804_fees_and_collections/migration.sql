-- CreateEnum
CREATE TYPE "FeeCategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FeeStructureStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FeeAssignmentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "FeeAdjustmentKind" AS ENUM ('DISCOUNT', 'SCHOLARSHIP', 'LATE_FEE');

-- CreateEnum
CREATE TYPE "FeeAdjustmentAmountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "FeePaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "FeeReconciliationStatus" AS ENUM ('UNRECONCILED', 'RECONCILED', 'MISMATCH');

-- CreateTable
CREATE TABLE "fee_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "FeeCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fee_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_structures" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "FeeStructureStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_structure_classes" (
    "id" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,

    CONSTRAINT "fee_structure_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_structure_items" (
    "id" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fee_structure_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_fee_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "feeStructureId" TEXT NOT NULL,
    "status" "FeeAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedByUserId" TEXT NOT NULL,
    "assignedByName" TEXT,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_fee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_charges" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeStructureItemId" TEXT,
    "categoryName" TEXT NOT NULL,
    "itemName" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fee_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_adjustments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "kind" "FeeAdjustmentKind" NOT NULL,
    "amountType" "FeeAdjustmentAmountType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "computedAmount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "appliedByUserId" TEXT NOT NULL,
    "appliedByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "method" "FeePaymentMethod" NOT NULL,
    "paymentDate" DATE NOT NULL,
    "reference" TEXT,
    "chequeNumber" TEXT,
    "chequeDate" DATE,
    "bankName" TEXT,
    "notes" TEXT,
    "receivedByUserId" TEXT NOT NULL,
    "receivedByName" TEXT,
    "reconciliationStatus" "FeeReconciliationStatus" NOT NULL DEFAULT 'UNRECONCILED',
    "reconciledByUserId" TEXT,
    "reconciledByName" TEXT,
    "reconciledAt" TIMESTAMPTZ(6),
    "reconciliationNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_refunds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "refundedByUserId" TEXT NOT NULL,
    "refundedByName" TEXT,
    "refundedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_receipt_counters" (
    "schoolId" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fee_receipt_counters_pkey" PRIMARY KEY ("schoolId")
);

-- CreateIndex
CREATE INDEX "fee_categories_tenantId_idx" ON "fee_categories"("tenantId");

-- CreateIndex
CREATE INDEX "fee_categories_schoolId_status_idx" ON "fee_categories"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fee_categories_schoolId_code_key" ON "fee_categories"("schoolId", "code");

-- CreateIndex
CREATE INDEX "fee_structures_tenantId_idx" ON "fee_structures"("tenantId");

-- CreateIndex
CREATE INDEX "fee_structures_schoolId_academicSessionId_status_idx" ON "fee_structures"("schoolId", "academicSessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fee_structures_schoolId_academicSessionId_name_key" ON "fee_structures"("schoolId", "academicSessionId", "name");

-- CreateIndex
CREATE INDEX "fee_structure_classes_classId_idx" ON "fee_structure_classes"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_structure_classes_feeStructureId_classId_key" ON "fee_structure_classes"("feeStructureId", "classId");

-- CreateIndex
CREATE INDEX "fee_structure_items_feeStructureId_idx" ON "fee_structure_items"("feeStructureId");

-- CreateIndex
CREATE INDEX "fee_structure_items_categoryId_idx" ON "fee_structure_items"("categoryId");

-- CreateIndex
CREATE INDEX "student_fee_assignments_tenantId_idx" ON "student_fee_assignments"("tenantId");

-- CreateIndex
CREATE INDEX "student_fee_assignments_schoolId_academicSessionId_idx" ON "student_fee_assignments"("schoolId", "academicSessionId");

-- CreateIndex
CREATE INDEX "student_fee_assignments_studentId_idx" ON "student_fee_assignments"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_fee_assignments_studentId_feeStructureId_key" ON "student_fee_assignments"("studentId", "feeStructureId");

-- CreateIndex
CREATE INDEX "fee_charges_tenantId_idx" ON "fee_charges"("tenantId");

-- CreateIndex
CREATE INDEX "fee_charges_schoolId_academicSessionId_idx" ON "fee_charges"("schoolId", "academicSessionId");

-- CreateIndex
CREATE INDEX "fee_charges_studentId_dueDate_idx" ON "fee_charges"("studentId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "fee_charges_assignmentId_feeStructureItemId_key" ON "fee_charges"("assignmentId", "feeStructureItemId");

-- CreateIndex
CREATE INDEX "fee_adjustments_tenantId_idx" ON "fee_adjustments"("tenantId");

-- CreateIndex
CREATE INDEX "fee_adjustments_chargeId_idx" ON "fee_adjustments"("chargeId");

-- CreateIndex
CREATE INDEX "fee_adjustments_schoolId_kind_idx" ON "fee_adjustments"("schoolId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "fee_payments_receiptNumber_key" ON "fee_payments"("receiptNumber");

-- CreateIndex
CREATE INDEX "fee_payments_tenantId_idx" ON "fee_payments"("tenantId");

-- CreateIndex
CREATE INDEX "fee_payments_schoolId_academicSessionId_idx" ON "fee_payments"("schoolId", "academicSessionId");

-- CreateIndex
CREATE INDEX "fee_payments_studentId_idx" ON "fee_payments"("studentId");

-- CreateIndex
CREATE INDEX "fee_payments_schoolId_paymentDate_idx" ON "fee_payments"("schoolId", "paymentDate");

-- CreateIndex
CREATE INDEX "fee_payments_reconciliationStatus_idx" ON "fee_payments"("reconciliationStatus");

-- CreateIndex
CREATE INDEX "fee_payment_allocations_chargeId_idx" ON "fee_payment_allocations"("chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_payment_allocations_paymentId_chargeId_key" ON "fee_payment_allocations"("paymentId", "chargeId");

-- CreateIndex
CREATE INDEX "fee_refunds_tenantId_idx" ON "fee_refunds"("tenantId");

-- CreateIndex
CREATE INDEX "fee_refunds_paymentId_idx" ON "fee_refunds"("paymentId");

-- AddForeignKey
ALTER TABLE "fee_structure_classes" ADD CONSTRAINT "fee_structure_classes_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structure_classes" ADD CONSTRAINT "fee_structure_classes_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structure_items" ADD CONSTRAINT "fee_structure_items_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structure_items" ADD CONSTRAINT "fee_structure_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_charges" ADD CONSTRAINT "fee_charges_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "student_fee_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_charges" ADD CONSTRAINT "fee_charges_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_charges" ADD CONSTRAINT "fee_charges_feeStructureItemId_fkey" FOREIGN KEY ("feeStructureItemId") REFERENCES "fee_structure_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "fee_charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payment_allocations" ADD CONSTRAINT "fee_payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "fee_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payment_allocations" ADD CONSTRAINT "fee_payment_allocations_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "fee_charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "fee_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
