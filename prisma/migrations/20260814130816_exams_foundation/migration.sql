-- CreateEnum
CREATE TYPE "ExamTermStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('UNIT_TEST', 'WEEKLY_TEST', 'MONTHLY_TEST', 'MIDTERM', 'HALF_YEARLY', 'ANNUAL', 'PRE_BOARD', 'BOARD', 'PRACTICAL', 'ORAL', 'ASSIGNMENT', 'PROJECT', 'INTERNAL_ASSESSMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ExamScope" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ExamMode" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateTable
CREATE TABLE "exam_terms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "ExamTermStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exam_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "examTermId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ExamType" NOT NULL DEFAULT 'CUSTOM',
    "description" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "scope" "ExamScope" NOT NULL DEFAULT 'INTERNAL',
    "mode" "ExamMode" NOT NULL DEFAULT 'OFFLINE',
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_classes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_schedule_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "examDate" DATE NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "maxMarks" INTEGER NOT NULL,
    "passingMarks" INTEGER NOT NULL,
    "theoryMarks" INTEGER NOT NULL,
    "practicalMarks" INTEGER NOT NULL,
    "invigilatorStaffId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exam_schedule_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_terms_tenantId_idx" ON "exam_terms"("tenantId");

-- CreateIndex
CREATE INDEX "exam_terms_schoolId_academicSessionId_idx" ON "exam_terms"("schoolId", "academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_terms_schoolId_academicSessionId_code_key" ON "exam_terms"("schoolId", "academicSessionId", "code");

-- CreateIndex
CREATE INDEX "exams_tenantId_idx" ON "exams"("tenantId");

-- CreateIndex
CREATE INDEX "exams_schoolId_academicSessionId_status_idx" ON "exams"("schoolId", "academicSessionId", "status");

-- CreateIndex
CREATE INDEX "exams_examTermId_idx" ON "exams"("examTermId");

-- CreateIndex
CREATE UNIQUE INDEX "exams_schoolId_academicSessionId_code_key" ON "exams"("schoolId", "academicSessionId", "code");

-- CreateIndex
CREATE INDEX "exam_classes_tenantId_idx" ON "exam_classes"("tenantId");

-- CreateIndex
CREATE INDEX "exam_classes_examId_idx" ON "exam_classes"("examId");

-- CreateIndex
CREATE INDEX "exam_classes_classId_idx" ON "exam_classes"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_classes_examId_classId_key" ON "exam_classes"("examId", "classId");

-- CreateIndex
CREATE INDEX "exam_schedule_entries_tenantId_idx" ON "exam_schedule_entries"("tenantId");

-- CreateIndex
CREATE INDEX "exam_schedule_entries_schoolId_academicSessionId_idx" ON "exam_schedule_entries"("schoolId", "academicSessionId");

-- CreateIndex
CREATE INDEX "exam_schedule_entries_examId_idx" ON "exam_schedule_entries"("examId");

-- CreateIndex
CREATE INDEX "exam_schedule_entries_subjectId_idx" ON "exam_schedule_entries"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_schedule_entries_examId_sectionId_subjectId_key" ON "exam_schedule_entries"("examId", "sectionId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_schedule_entries_sectionId_examDate_key" ON "exam_schedule_entries"("sectionId", "examDate");

-- CreateIndex
CREATE UNIQUE INDEX "exam_schedule_entries_invigilatorStaffId_examDate_key" ON "exam_schedule_entries"("invigilatorStaffId", "examDate");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_examTermId_fkey" FOREIGN KEY ("examTermId") REFERENCES "exam_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_classes" ADD CONSTRAINT "exam_classes_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_classes" ADD CONSTRAINT "exam_classes_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_schedule_entries" ADD CONSTRAINT "exam_schedule_entries_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_schedule_entries" ADD CONSTRAINT "exam_schedule_entries_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_schedule_entries" ADD CONSTRAINT "exam_schedule_entries_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_schedule_entries" ADD CONSTRAINT "exam_schedule_entries_invigilatorStaffId_fkey" FOREIGN KEY ("invigilatorStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
