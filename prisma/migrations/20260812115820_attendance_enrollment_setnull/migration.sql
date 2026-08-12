-- DropForeignKey
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_enrollmentId_fkey";

-- AlterTable
ALTER TABLE "attendance_records" ALTER COLUMN "enrollmentId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
