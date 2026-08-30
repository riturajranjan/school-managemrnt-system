-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PERMANENT', 'FIXED_TERM', 'PROBATION', 'TEMPORARY', 'PART_TIME', 'CONSULTANT', 'VISITING_FACULTY');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RENEWAL_PENDING', 'EXPIRED', 'TERMINATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StaffDocumentType" AS ENUM ('ID_PROOF', 'TAX_ID', 'QUALIFICATION', 'EXPERIENCE_CERTIFICATE', 'APPOINTMENT_LETTER', 'CONTRACT', 'LICENSE', 'BACKGROUND_CHECK', 'MEDICAL_FITNESS', 'TRAINING_CERTIFICATE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "StaffDocumentStatus" AS ENUM ('UPLOADED', 'VERIFIED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StaffDocumentVisibility" AS ENUM ('HR_ONLY', 'STAFF_VISIBLE');

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "probationMonths" INTEGER,
    "noticePeriodDays" INTEGER,
    "workHoursPerWeek" INTEGER,
    "compensationNote" TEXT,
    "terms" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "updatedByUserId" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" "StaffDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "StaffDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "visibility" "StaffDocumentVisibility" NOT NULL DEFAULT 'HR_ONLY',
    "externalReference" TEXT,
    "expiryDate" DATE,
    "notes" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedByName" TEXT,
    "uploadedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedByUserId" TEXT,
    "verifiedByName" TEXT,
    "verifiedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contracts_tenantId_idx" ON "contracts"("tenantId");

-- CreateIndex
CREATE INDEX "contracts_schoolId_staffId_idx" ON "contracts"("schoolId", "staffId");

-- CreateIndex
CREATE INDEX "contracts_schoolId_status_idx" ON "contracts"("schoolId", "status");

-- CreateIndex
CREATE INDEX "staff_documents_tenantId_idx" ON "staff_documents"("tenantId");

-- CreateIndex
CREATE INDEX "staff_documents_schoolId_staffId_idx" ON "staff_documents"("schoolId", "staffId");

-- CreateIndex
CREATE INDEX "staff_documents_schoolId_status_idx" ON "staff_documents"("schoolId", "status");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_documents" ADD CONSTRAINT "staff_documents_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
