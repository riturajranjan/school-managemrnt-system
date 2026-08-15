-- CreateEnum
CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "LeaveTypeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_REQUEST_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_REQUEST_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_REQUEST_REJECTED';

-- CreateTable
CREATE TABLE "staff_attendance_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "StaffAttendanceStatus" NOT NULL,
    "checkInAt" TIMESTAMPTZ(6),
    "checkOutAt" TIMESTAMPTZ(6),
    "notes" TEXT,
    "markedByUserId" TEXT NOT NULL,
    "markedByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "status" "LeaveTypeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "halfDay" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMPTZ(6),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_attendance_records_tenantId_idx" ON "staff_attendance_records"("tenantId");

-- CreateIndex
CREATE INDEX "staff_attendance_records_schoolId_branchId_date_idx" ON "staff_attendance_records"("schoolId", "branchId", "date");

-- CreateIndex
CREATE INDEX "staff_attendance_records_staffId_date_idx" ON "staff_attendance_records"("staffId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "staff_attendance_records_staffId_date_key" ON "staff_attendance_records"("staffId", "date");

-- CreateIndex
CREATE INDEX "leave_types_tenantId_idx" ON "leave_types"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_schoolId_code_key" ON "leave_types"("schoolId", "code");

-- CreateIndex
CREATE INDEX "leave_requests_tenantId_idx" ON "leave_requests"("tenantId");

-- CreateIndex
CREATE INDEX "leave_requests_schoolId_branchId_idx" ON "leave_requests"("schoolId", "branchId");

-- CreateIndex
CREATE INDEX "leave_requests_staffId_status_idx" ON "leave_requests"("staffId", "status");

-- CreateIndex
CREATE INDEX "leave_requests_staffId_startDate_endDate_idx" ON "leave_requests"("staffId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- AddForeignKey
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
