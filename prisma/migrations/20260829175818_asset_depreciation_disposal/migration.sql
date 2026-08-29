-- CreateEnum
CREATE TYPE "AssetDepreciationMethod" AS ENUM ('NONE', 'STRAIGHT_LINE', 'DECLINING_BALANCE');

-- CreateEnum
CREATE TYPE "AssetDisposalReason" AS ENUM ('END_OF_LIFE', 'DAMAGED', 'SOLD', 'DONATED', 'LOST', 'STOLEN', 'REPLACED', 'OTHER');

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "depreciationMethod" "AssetDepreciationMethod" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "depreciationRatePercent" DECIMAL(5,2),
ADD COLUMN     "salvageValue" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "asset_disposals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "reason" "AssetDisposalReason" NOT NULL,
    "value" DECIMAL(12,2),
    "recipient" TEXT,
    "notes" TEXT,
    "disposedAt" DATE NOT NULL,
    "approvedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_disposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_disposals_assetId_key" ON "asset_disposals"("assetId");

-- CreateIndex
CREATE INDEX "asset_disposals_schoolId_idx" ON "asset_disposals"("schoolId");

-- AddForeignKey
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
