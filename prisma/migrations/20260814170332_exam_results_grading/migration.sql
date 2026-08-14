-- CreateEnum
CREATE TYPE "GradingSchemeStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExamResultStatus" AS ENUM ('PASS', 'FAIL', 'ABSENT');

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "gradingSchemeId" TEXT;

-- CreateTable
CREATE TABLE "grading_schemes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "GradingSchemeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grading_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grading_bands" (
    "id" TEXT NOT NULL,
    "gradingSchemeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minPercent" INTEGER NOT NULL,
    "maxPercent" INTEGER NOT NULL,
    "isPass" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grading_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_result_publications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "gradingSchemeId" TEXT NOT NULL,
    "gradingBandsSnapshot" JSONB NOT NULL,
    "studentCount" INTEGER NOT NULL,
    "publishedByUserId" TEXT NOT NULL,
    "publishedByName" TEXT,
    "publishedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_result_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_exam_results" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "totalMaxMarks" INTEGER NOT NULL,
    "totalMarksObtained" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "grade" TEXT,
    "status" "ExamResultStatus" NOT NULL,
    "subjectResults" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_exam_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grading_schemes_tenantId_idx" ON "grading_schemes"("tenantId");

-- CreateIndex
CREATE INDEX "grading_schemes_schoolId_academicSessionId_idx" ON "grading_schemes"("schoolId", "academicSessionId");

-- CreateIndex
CREATE INDEX "grading_bands_gradingSchemeId_idx" ON "grading_bands"("gradingSchemeId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_result_publications_examId_key" ON "exam_result_publications"("examId");

-- CreateIndex
CREATE INDEX "exam_result_publications_tenantId_idx" ON "exam_result_publications"("tenantId");

-- CreateIndex
CREATE INDEX "exam_result_publications_schoolId_academicSessionId_idx" ON "exam_result_publications"("schoolId", "academicSessionId");

-- CreateIndex
CREATE INDEX "student_exam_results_publicationId_idx" ON "student_exam_results"("publicationId");

-- CreateIndex
CREATE INDEX "student_exam_results_studentId_idx" ON "student_exam_results"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_exam_results_publicationId_studentId_key" ON "student_exam_results"("publicationId", "studentId");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_gradingSchemeId_fkey" FOREIGN KEY ("gradingSchemeId") REFERENCES "grading_schemes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_bands" ADD CONSTRAINT "grading_bands_gradingSchemeId_fkey" FOREIGN KEY ("gradingSchemeId") REFERENCES "grading_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_result_publications" ADD CONSTRAINT "exam_result_publications_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_exam_results" ADD CONSTRAINT "student_exam_results_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "exam_result_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_exam_results" ADD CONSTRAINT "student_exam_results_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_exam_results" ADD CONSTRAINT "student_exam_results_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
