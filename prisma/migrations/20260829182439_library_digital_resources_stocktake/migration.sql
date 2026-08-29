-- CreateEnum
CREATE TYPE "LibraryDigitalResourceType" AS ENUM ('EBOOK', 'NOTES', 'QUESTION_PAPER', 'AUDIO', 'VIDEO', 'OTHER');

-- CreateEnum
CREATE TYPE "LibraryDigitalAccessLevel" AS ENUM ('ALL', 'STUDENTS', 'STAFF');

-- CreateEnum
CREATE TYPE "LibraryStocktakeScope" AS ENUM ('SHELF', 'FULL');

-- CreateEnum
CREATE TYPE "LibraryStocktakeStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "library_digital_resources" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "type" "LibraryDigitalResourceType" NOT NULL,
    "url" TEXT NOT NULL,
    "accessLevel" "LibraryDigitalAccessLevel" NOT NULL DEFAULT 'ALL',
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "library_digital_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_stocktakes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "scope" "LibraryStocktakeScope" NOT NULL,
    "shelfLocation" TEXT,
    "status" "LibraryStocktakeStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedByUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "library_stocktakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_stocktake_scans" (
    "id" TEXT NOT NULL,
    "stocktakeId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "scannedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_stocktake_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "library_digital_resources_schoolId_idx" ON "library_digital_resources"("schoolId");

-- CreateIndex
CREATE INDEX "library_stocktakes_schoolId_status_idx" ON "library_stocktakes"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "library_stocktakes_schoolId_reference_key" ON "library_stocktakes"("schoolId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "library_stocktake_scans_stocktakeId_copyId_key" ON "library_stocktake_scans"("stocktakeId", "copyId");

-- AddForeignKey
ALTER TABLE "library_digital_resources" ADD CONSTRAINT "library_digital_resources_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_stocktakes" ADD CONSTRAINT "library_stocktakes_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_stocktake_scans" ADD CONSTRAINT "library_stocktake_scans_stocktakeId_fkey" FOREIGN KEY ("stocktakeId") REFERENCES "library_stocktakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_stocktake_scans" ADD CONSTRAINT "library_stocktake_scans_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "library_book_copies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
