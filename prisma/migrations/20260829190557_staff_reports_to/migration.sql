-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "reportsToStaffId" TEXT;

-- CreateIndex
CREATE INDEX "staff_reportsToStaffId_idx" ON "staff"("reportsToStaffId");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_reportsToStaffId_fkey" FOREIGN KEY ("reportsToStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
