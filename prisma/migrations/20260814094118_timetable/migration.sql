-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('TEACHING', 'BREAK');

-- CreateTable
CREATE TABLE "timetable_periods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "type" "PeriodType" NOT NULL DEFAULT 'TEACHING',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "timetable_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "teachingAssignmentId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "timetable_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timetable_periods_tenantId_idx" ON "timetable_periods"("tenantId");

-- CreateIndex
CREATE INDEX "timetable_periods_schoolId_branchId_academicSessionId_idx" ON "timetable_periods"("schoolId", "branchId", "academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_periods_schoolId_branchId_academicSessionId_perio_key" ON "timetable_periods"("schoolId", "branchId", "academicSessionId", "periodNumber");

-- CreateIndex
CREATE INDEX "timetable_entries_tenantId_idx" ON "timetable_entries"("tenantId");

-- CreateIndex
CREATE INDEX "timetable_entries_schoolId_branchId_academicSessionId_idx" ON "timetable_entries"("schoolId", "branchId", "academicSessionId");

-- CreateIndex
CREATE INDEX "timetable_entries_sectionId_idx" ON "timetable_entries"("sectionId");

-- CreateIndex
CREATE INDEX "timetable_entries_staffId_idx" ON "timetable_entries"("staffId");

-- CreateIndex
CREATE INDEX "timetable_entries_periodId_idx" ON "timetable_entries"("periodId");

-- CreateIndex
CREATE INDEX "timetable_entries_teachingAssignmentId_idx" ON "timetable_entries"("teachingAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_entries_sectionId_weekday_periodId_key" ON "timetable_entries"("sectionId", "weekday", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_entries_staffId_weekday_periodId_key" ON "timetable_entries"("staffId", "weekday", "periodId");

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "teaching_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "timetable_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
