-- CreateEnum
CREATE TYPE "ExamMarkSheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ExamMarkStatus" AS ENUM ('PENDING', 'MARKED', 'ABSENT', 'EXEMPT');

-- CreateTable
CREATE TABLE "exam_mark_sheets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "examScheduleEntryId" TEXT NOT NULL,
    "status" "ExamMarkSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedByUserId" TEXT,
    "submittedByName" TEXT,
    "submittedAt" TIMESTAMPTZ(6),
    "verifiedByUserId" TEXT,
    "verifiedByName" TEXT,
    "verifiedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exam_mark_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_marks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "markSheetId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "status" "ExamMarkStatus" NOT NULL DEFAULT 'PENDING',
    "theoryMarks" INTEGER,
    "practicalMarks" INTEGER,
    "marksObtained" INTEGER,
    "remarks" TEXT,
    "enteredByUserId" TEXT,
    "enteredByName" TEXT,
    "enteredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exam_marks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_mark_sheets_examScheduleEntryId_key" ON "exam_mark_sheets"("examScheduleEntryId");

-- CreateIndex
CREATE INDEX "exam_mark_sheets_tenantId_idx" ON "exam_mark_sheets"("tenantId");

-- CreateIndex
CREATE INDEX "exam_mark_sheets_schoolId_academicSessionId_idx" ON "exam_mark_sheets"("schoolId", "academicSessionId");

-- CreateIndex
CREATE INDEX "exam_marks_tenantId_idx" ON "exam_marks"("tenantId");

-- CreateIndex
CREATE INDEX "exam_marks_schoolId_academicSessionId_idx" ON "exam_marks"("schoolId", "academicSessionId");

-- CreateIndex
CREATE INDEX "exam_marks_studentId_idx" ON "exam_marks"("studentId");

-- CreateIndex
CREATE INDEX "exam_marks_enrollmentId_idx" ON "exam_marks"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_marks_markSheetId_studentId_key" ON "exam_marks"("markSheetId", "studentId");

-- AddForeignKey
ALTER TABLE "exam_mark_sheets" ADD CONSTRAINT "exam_mark_sheets_examScheduleEntryId_fkey" FOREIGN KEY ("examScheduleEntryId") REFERENCES "exam_schedule_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_markSheetId_fkey" FOREIGN KEY ("markSheetId") REFERENCES "exam_mark_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
