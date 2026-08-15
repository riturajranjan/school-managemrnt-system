-- CreateEnum
CREATE TYPE "PromotionDecision" AS ENUM ('PROMOTED', 'RETAINED');

-- CreateTable
CREATE TABLE "student_promotions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "fromAcademicSessionId" TEXT NOT NULL,
    "toAcademicSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromEnrollmentId" TEXT NOT NULL,
    "newEnrollmentId" TEXT NOT NULL,
    "sourceExamId" TEXT NOT NULL,
    "sourcePublicationId" TEXT NOT NULL,
    "sourceStudentResultId" TEXT NOT NULL,
    "decision" "PromotionDecision" NOT NULL,
    "targetClassId" TEXT NOT NULL,
    "targetSectionId" TEXT NOT NULL,
    "processedByUserId" TEXT NOT NULL,
    "processedByName" TEXT,
    "processedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_promotions_newEnrollmentId_key" ON "student_promotions"("newEnrollmentId");

-- CreateIndex
CREATE INDEX "student_promotions_tenantId_idx" ON "student_promotions"("tenantId");

-- CreateIndex
CREATE INDEX "student_promotions_schoolId_fromAcademicSessionId_toAcademi_idx" ON "student_promotions"("schoolId", "fromAcademicSessionId", "toAcademicSessionId");

-- CreateIndex
CREATE INDEX "student_promotions_studentId_idx" ON "student_promotions"("studentId");

-- CreateIndex
CREATE INDEX "student_promotions_targetClassId_idx" ON "student_promotions"("targetClassId");

-- CreateIndex
CREATE INDEX "student_promotions_targetSectionId_idx" ON "student_promotions"("targetSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "student_promotions_studentId_fromAcademicSessionId_toAcadem_key" ON "student_promotions"("studentId", "fromAcademicSessionId", "toAcademicSessionId");

-- AddForeignKey
ALTER TABLE "student_promotions" ADD CONSTRAINT "student_promotions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_promotions" ADD CONSTRAINT "student_promotions_fromEnrollmentId_fkey" FOREIGN KEY ("fromEnrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_promotions" ADD CONSTRAINT "student_promotions_newEnrollmentId_fkey" FOREIGN KEY ("newEnrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_promotions" ADD CONSTRAINT "student_promotions_targetClassId_fkey" FOREIGN KEY ("targetClassId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_promotions" ADD CONSTRAINT "student_promotions_targetSectionId_fkey" FOREIGN KEY ("targetSectionId") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
