-- CreateEnum
CREATE TYPE "HostelIssuePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "HostelLeaveType" AS ENUM ('HOME', 'MEDICAL', 'WEEKEND', 'EMERGENCY', 'DAY_OUT', 'OTHER');

-- CreateEnum
CREATE TYPE "HostelLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HostelVisitorStatus" AS ENUM ('EXPECTED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HostelComplaintCategory" AS ENUM ('ELECTRICITY', 'WATER', 'FURNITURE', 'CLEANING', 'BATHROOM', 'WIFI', 'ROOMMATE', 'SAFETY', 'MESS', 'OTHER');

-- CreateEnum
CREATE TYPE "HostelComplaintStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "HostelMaintenanceStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "hostel_leave_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "leaveType" "HostelLeaveType" NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "remarks" TEXT,
    "status" "HostelLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMPTZ(6),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hostel_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_visitors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "phone" TEXT,
    "purpose" TEXT NOT NULL,
    "expectedAt" TIMESTAMPTZ(6),
    "checkedInAt" TIMESTAMPTZ(6),
    "checkedOutAt" TIMESTAMPTZ(6),
    "status" "HostelVisitorStatus" NOT NULL DEFAULT 'EXPECTED',
    "approvedByUserId" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMPTZ(6),
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hostel_visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_complaints" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "roomId" TEXT,
    "category" "HostelComplaintCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "HostelIssuePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "HostelComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "assignedStaffId" TEXT,
    "assignedAt" TIMESTAMPTZ(6),
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMPTZ(6),
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hostel_complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_maintenance_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "roomId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "HostelIssuePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "HostelMaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "assignedStaffId" TEXT,
    "assignedAt" TIMESTAMPTZ(6),
    "reportedByUserId" TEXT NOT NULL,
    "reportedByName" TEXT,
    "reportedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hostel_maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hostel_leave_requests_tenantId_idx" ON "hostel_leave_requests"("tenantId");

-- CreateIndex
CREATE INDEX "hostel_leave_requests_schoolId_branchId_status_idx" ON "hostel_leave_requests"("schoolId", "branchId", "status");

-- CreateIndex
CREATE INDEX "hostel_leave_requests_schoolId_studentId_idx" ON "hostel_leave_requests"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "hostel_leave_requests_schoolId_hostelId_idx" ON "hostel_leave_requests"("schoolId", "hostelId");

-- CreateIndex
CREATE INDEX "hostel_visitors_tenantId_idx" ON "hostel_visitors"("tenantId");

-- CreateIndex
CREATE INDEX "hostel_visitors_schoolId_branchId_status_idx" ON "hostel_visitors"("schoolId", "branchId", "status");

-- CreateIndex
CREATE INDEX "hostel_visitors_schoolId_studentId_idx" ON "hostel_visitors"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "hostel_visitors_schoolId_hostelId_status_idx" ON "hostel_visitors"("schoolId", "hostelId", "status");

-- CreateIndex
CREATE INDEX "hostel_complaints_tenantId_idx" ON "hostel_complaints"("tenantId");

-- CreateIndex
CREATE INDEX "hostel_complaints_schoolId_branchId_status_idx" ON "hostel_complaints"("schoolId", "branchId", "status");

-- CreateIndex
CREATE INDEX "hostel_complaints_schoolId_studentId_idx" ON "hostel_complaints"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "hostel_complaints_schoolId_hostelId_idx" ON "hostel_complaints"("schoolId", "hostelId");

-- CreateIndex
CREATE INDEX "hostel_complaints_assignedStaffId_idx" ON "hostel_complaints"("assignedStaffId");

-- CreateIndex
CREATE INDEX "hostel_maintenance_requests_tenantId_idx" ON "hostel_maintenance_requests"("tenantId");

-- CreateIndex
CREATE INDEX "hostel_maintenance_requests_schoolId_branchId_status_idx" ON "hostel_maintenance_requests"("schoolId", "branchId", "status");

-- CreateIndex
CREATE INDEX "hostel_maintenance_requests_schoolId_hostelId_idx" ON "hostel_maintenance_requests"("schoolId", "hostelId");

-- CreateIndex
CREATE INDEX "hostel_maintenance_requests_assignedStaffId_idx" ON "hostel_maintenance_requests"("assignedStaffId");

-- AddForeignKey
ALTER TABLE "hostel_leave_requests" ADD CONSTRAINT "hostel_leave_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_leave_requests" ADD CONSTRAINT "hostel_leave_requests_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_leave_requests" ADD CONSTRAINT "hostel_leave_requests_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "hostel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_visitors" ADD CONSTRAINT "hostel_visitors_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_visitors" ADD CONSTRAINT "hostel_visitors_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_visitors" ADD CONSTRAINT "hostel_visitors_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "hostel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_complaints" ADD CONSTRAINT "hostel_complaints_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_complaints" ADD CONSTRAINT "hostel_complaints_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_complaints" ADD CONSTRAINT "hostel_complaints_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "hostel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_complaints" ADD CONSTRAINT "hostel_complaints_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_maintenance_requests" ADD CONSTRAINT "hostel_maintenance_requests_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_maintenance_requests" ADD CONSTRAINT "hostel_maintenance_requests_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "hostel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_maintenance_requests" ADD CONSTRAINT "hostel_maintenance_requests_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
