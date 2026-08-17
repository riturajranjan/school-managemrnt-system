-- CreateEnum
CREATE TYPE "VisitorCategory" AS ENUM ('PARENT', 'VENDOR', 'GUEST', 'CONTRACTOR', 'INTERVIEW_CANDIDATE', 'ALUMNI', 'OFFICIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitorVisitStatus" AS ENUM ('EXPECTED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'VISITOR_CHECKED_IN';

-- CreateTable
CREATE TABLE "visitors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "organization" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_visits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "hostStaffId" TEXT NOT NULL,
    "category" "VisitorCategory" NOT NULL DEFAULT 'GUEST',
    "purpose" TEXT NOT NULL,
    "department" TEXT,
    "vehicleNumber" TEXT,
    "status" "VisitorVisitStatus" NOT NULL DEFAULT 'EXPECTED',
    "expectedAt" TIMESTAMPTZ(6),
    "checkedInAt" TIMESTAMPTZ(6),
    "checkedOutAt" TIMESTAMPTZ(6),
    "passNumber" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "visitor_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_pass_counters" (
    "schoolId" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "visitor_pass_counters_pkey" PRIMARY KEY ("schoolId")
);

-- CreateIndex
CREATE INDEX "visitors_tenantId_idx" ON "visitors"("tenantId");

-- CreateIndex
CREATE INDEX "visitors_schoolId_phone_idx" ON "visitors"("schoolId", "phone");

-- CreateIndex
CREATE INDEX "visitor_visits_tenantId_idx" ON "visitor_visits"("tenantId");

-- CreateIndex
CREATE INDEX "visitor_visits_schoolId_branchId_status_idx" ON "visitor_visits"("schoolId", "branchId", "status");

-- CreateIndex
CREATE INDEX "visitor_visits_schoolId_status_expectedAt_idx" ON "visitor_visits"("schoolId", "status", "expectedAt");

-- CreateIndex
CREATE INDEX "visitor_visits_visitorId_idx" ON "visitor_visits"("visitorId");

-- CreateIndex
CREATE INDEX "visitor_visits_hostStaffId_idx" ON "visitor_visits"("hostStaffId");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_visits_schoolId_passNumber_key" ON "visitor_visits"("schoolId", "passNumber");

-- AddForeignKey
ALTER TABLE "visitor_visits" ADD CONSTRAINT "visitor_visits_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_visits" ADD CONSTRAINT "visitor_visits_hostStaffId_fkey" FOREIGN KEY ("hostStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
