-- CreateEnum
CREATE TYPE "AttendanceSessionType" AS ENUM ('DAILY', 'PERIOD');

-- DropIndex
DROP INDEX "attendance_sessions_schoolId_academicSessionId_date_idx";

-- DropIndex
DROP INDEX "attendance_sessions_sectionId_date_key";

-- AlterTable
ALTER TABLE "attendance_sessions" ADD COLUMN     "periodId" TEXT,
ADD COLUMN     "periodName" TEXT,
ADD COLUMN     "staffId" TEXT,
ADD COLUMN     "staffName" TEXT,
ADD COLUMN     "subjectCode" TEXT,
ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "subjectName" TEXT,
ADD COLUMN     "timetableEntryId" TEXT,
ADD COLUMN     "type" "AttendanceSessionType" NOT NULL DEFAULT 'DAILY';

-- CreateIndex
CREATE INDEX "attendance_sessions_schoolId_academicSessionId_type_date_idx" ON "attendance_sessions"("schoolId", "academicSessionId", "type", "date");

-- CreateIndex
CREATE INDEX "attendance_sessions_timetableEntryId_date_idx" ON "attendance_sessions"("timetableEntryId", "date");

-- CreateIndex
CREATE INDEX "attendance_sessions_subjectId_date_idx" ON "attendance_sessions"("subjectId", "date");

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_timetableEntryId_fkey" FOREIGN KEY ("timetableEntryId") REFERENCES "timetable_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique indexes (Prisma cannot express these). One DAILY register per
-- section/date; one PERIOD register per timetable lesson/date. Both concurrency-safe.
CREATE UNIQUE INDEX "attendance_sessions_daily_uq" ON "attendance_sessions"("sectionId", "date") WHERE "type" = 'DAILY';
CREATE UNIQUE INDEX "attendance_sessions_period_uq" ON "attendance_sessions"("timetableEntryId", "date") WHERE "type" = 'PERIOD';
