-- CreateEnum
CREATE TYPE "InventoryItemStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InventoryLocationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('OPENING', 'RECEIPT', 'ISSUE', 'RETURN', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT');

-- CreateEnum
CREATE TYPE "InventoryRecipientKind" AS ENUM ('STAFF', 'STUDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryIssueStatus" AS ENUM ('ISSUED', 'PARTIALLY_RETURNED', 'RETURNED');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'LOST', 'DAMAGED', 'RETIRED');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- CreateEnum
CREATE TYPE "AssetMaintenanceType" AS ENUM ('PREVENTIVE', 'REPAIR', 'INSPECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetMaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ASSET_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'ASSET_RETURNED';

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "reorderLevel" INTEGER,
    "status" "InventoryItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_locations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "InventoryLocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "movementType" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_issues" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
    "recipientKind" "InventoryRecipientKind" NOT NULL,
    "recipientStaffId" TEXT,
    "recipientStudentId" TEXT,
    "recipientLabel" TEXT,
    "purpose" TEXT,
    "returnable" BOOLEAN NOT NULL DEFAULT false,
    "status" "InventoryIssueStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_tag_counters" (
    "schoolId" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "asset_tag_counters_pkey" PRIMARY KEY ("schoolId")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "serialNumber" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "purchaseDate" DATE,
    "cost" DECIMAL(12,2),
    "warrantyUntil" DATE,
    "notes" TEXT,
    "locationId" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "assignedByUserId" TEXT NOT NULL,
    "returnedByUserId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_maintenance_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "AssetMaintenanceType" NOT NULL DEFAULT 'REPAIR',
    "status" "AssetMaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "vendorName" TEXT,
    "cost" DECIMAL(12,2),
    "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "asset_maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_items_schoolId_status_idx" ON "inventory_items"("schoolId", "status");

-- CreateIndex
CREATE INDEX "inventory_items_schoolId_category_idx" ON "inventory_items"("schoolId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_schoolId_code_key" ON "inventory_items"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_locations_schoolId_branchId_name_key" ON "inventory_locations"("schoolId", "branchId", "name");

-- CreateIndex
CREATE INDEX "inventory_stock_movements_schoolId_itemId_createdAt_idx" ON "inventory_stock_movements"("schoolId", "itemId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_stock_movements_schoolId_locationId_itemId_idx" ON "inventory_stock_movements"("schoolId", "locationId", "itemId");

-- CreateIndex
CREATE INDEX "inventory_stock_movements_referenceType_referenceId_idx" ON "inventory_stock_movements"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "inventory_issues_schoolId_itemId_idx" ON "inventory_issues"("schoolId", "itemId");

-- CreateIndex
CREATE INDEX "inventory_issues_schoolId_status_idx" ON "inventory_issues"("schoolId", "status");

-- CreateIndex
CREATE INDEX "inventory_issues_recipientStaffId_idx" ON "inventory_issues"("recipientStaffId");

-- CreateIndex
CREATE INDEX "inventory_issues_recipientStudentId_idx" ON "inventory_issues"("recipientStudentId");

-- CreateIndex
CREATE INDEX "assets_schoolId_status_idx" ON "assets"("schoolId", "status");

-- CreateIndex
CREATE INDEX "assets_schoolId_category_idx" ON "assets"("schoolId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "assets_schoolId_assetTag_key" ON "assets"("schoolId", "assetTag");

-- CreateIndex
CREATE INDEX "asset_assignments_schoolId_assetId_idx" ON "asset_assignments"("schoolId", "assetId");

-- CreateIndex
CREATE INDEX "asset_assignments_staffId_idx" ON "asset_assignments"("staffId");

-- CreateIndex
CREATE INDEX "asset_maintenance_records_schoolId_assetId_idx" ON "asset_maintenance_records"("schoolId", "assetId");

-- CreateIndex
CREATE INDEX "asset_maintenance_records_schoolId_status_idx" ON "asset_maintenance_records"("schoolId", "status");

-- AddForeignKey
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_issues" ADD CONSTRAINT "inventory_issues_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_issues" ADD CONSTRAINT "inventory_issues_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_issues" ADD CONSTRAINT "inventory_issues_recipientStaffId_fkey" FOREIGN KEY ("recipientStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_issues" ADD CONSTRAINT "inventory_issues_recipientStudentId_fkey" FOREIGN KEY ("recipientStudentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance_records" ADD CONSTRAINT "asset_maintenance_records_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
