-- CreateEnum
CREATE TYPE "CounselingCaseStatus" AS ENUM ('OPEN', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "CounselingReferralSource" AS ENUM ('SELF', 'TEACHER', 'PARENT_GUARDIAN', 'STAFF', 'ADMIN', 'OTHER');

-- CreateEnum
CREATE TYPE "CounselingConcernCategory" AS ENUM ('ACADEMIC', 'PEER_RELATIONSHIPS', 'BEHAVIORAL', 'FAMILY', 'EMOTIONAL_WELLBEING', 'OTHER');

-- CreateTable
CREATE TABLE "counseling_cases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT,
    "studentId" TEXT NOT NULL,
    "assignedCounselorStaffId" TEXT,
    "referralSource" "CounselingReferralSource",
    "referralReason" TEXT,
    "referredByUserId" TEXT,
    "referredAt" TIMESTAMPTZ(6),
    "concernCategory" "CounselingConcernCategory",
    "summary" TEXT,
    "status" "CounselingCaseStatus" NOT NULL DEFAULT 'OPEN',
    "followUpDate" DATE,
    "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "counseling_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counseling_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "counselorStaffId" TEXT NOT NULL,
    "sessionDate" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "sessionType" TEXT,
    "summary" TEXT,
    "followUpDate" DATE,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "counseling_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counseling_session_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "counseling_session_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "counseling_cases_schoolId_branchId_status_idx" ON "counseling_cases"("schoolId", "branchId", "status");

-- CreateIndex
CREATE INDEX "counseling_cases_studentId_idx" ON "counseling_cases"("studentId");

-- CreateIndex
CREATE INDEX "counseling_cases_assignedCounselorStaffId_idx" ON "counseling_cases"("assignedCounselorStaffId");

-- CreateIndex
CREATE INDEX "counseling_sessions_schoolId_branchId_idx" ON "counseling_sessions"("schoolId", "branchId");

-- CreateIndex
CREATE INDEX "counseling_sessions_caseId_idx" ON "counseling_sessions"("caseId");

-- CreateIndex
CREATE INDEX "counseling_sessions_counselorStaffId_idx" ON "counseling_sessions"("counselorStaffId");

-- CreateIndex
CREATE INDEX "counseling_session_notes_sessionId_idx" ON "counseling_session_notes"("sessionId");

-- AddForeignKey
ALTER TABLE "counseling_cases" ADD CONSTRAINT "counseling_cases_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counseling_cases" ADD CONSTRAINT "counseling_cases_assignedCounselorStaffId_fkey" FOREIGN KEY ("assignedCounselorStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counseling_sessions" ADD CONSTRAINT "counseling_sessions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "counseling_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counseling_sessions" ADD CONSTRAINT "counseling_sessions_counselorStaffId_fkey" FOREIGN KEY ("counselorStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counseling_session_notes" ADD CONSTRAINT "counseling_session_notes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "counseling_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
