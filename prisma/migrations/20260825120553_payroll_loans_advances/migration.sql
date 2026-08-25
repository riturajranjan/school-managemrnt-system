-- CreateEnum
CREATE TYPE "StaffFinancialAdvanceType" AS ENUM ('LOAN', 'ADVANCE');

-- CreateEnum
CREATE TYPE "StaffFinancialAdvanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISBURSED', 'PARTIALLY_REPAID', 'REPAID', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JournalSourceType" ADD VALUE 'STAFF_ADVANCE_DISBURSEMENT';
ALTER TYPE "JournalSourceType" ADD VALUE 'STAFF_ADVANCE_REPAYMENT';

-- CreateTable
CREATE TABLE "staff_financial_advances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "StaffFinancialAdvanceType" NOT NULL,
    "number" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "principalAmount" DECIMAL(12,2) NOT NULL,
    "approvedAmount" DECIMAL(12,2),
    "purpose" TEXT,
    "notes" TEXT,
    "status" "StaffFinancialAdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMPTZ(6),
    "approvedByUserId" TEXT,
    "approvedByName" TEXT,
    "rejectedAt" TIMESTAMPTZ(6),
    "rejectedByUserId" TEXT,
    "rejectedByName" TEXT,
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMPTZ(6),
    "cancelledByUserId" TEXT,
    "cancelledByName" TEXT,
    "disbursedAt" TIMESTAMPTZ(6),
    "disbursedByUserId" TEXT,
    "disbursedByName" TEXT,
    "disbursementMethod" "PayrollPaymentMethod",
    "disbursementReference" TEXT,
    "closedAt" TIMESTAMPTZ(6),
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_financial_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_financial_advance_repayments" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentDate" DATE NOT NULL,
    "method" "PayrollPaymentMethod" NOT NULL,
    "reference" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "recordedByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_financial_advance_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_financial_advance_counters" (
    "schoolId" TEXT NOT NULL,
    "type" "StaffFinancialAdvanceType" NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "staff_financial_advance_counters_pkey" PRIMARY KEY ("schoolId","type")
);

-- CreateIndex
CREATE INDEX "staff_financial_advances_tenantId_idx" ON "staff_financial_advances"("tenantId");

-- CreateIndex
CREATE INDEX "staff_financial_advances_schoolId_staffId_status_idx" ON "staff_financial_advances"("schoolId", "staffId", "status");

-- CreateIndex
CREATE INDEX "staff_financial_advances_schoolId_type_status_idx" ON "staff_financial_advances"("schoolId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_financial_advances_schoolId_number_key" ON "staff_financial_advances"("schoolId", "number");

-- CreateIndex
CREATE INDEX "staff_financial_advance_repayments_advanceId_idx" ON "staff_financial_advance_repayments"("advanceId");

-- AddForeignKey
ALTER TABLE "staff_financial_advances" ADD CONSTRAINT "staff_financial_advances_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_financial_advance_repayments" ADD CONSTRAINT "staff_financial_advance_repayments_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "staff_financial_advances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
