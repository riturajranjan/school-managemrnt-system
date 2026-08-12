-- CreateEnum
CREATE TYPE "AddOnStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SchoolAddOnStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "MarketplaceAppStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarketplaceInstallStatus" AS ENUM ('INSTALLED', 'DISABLED');

-- CreateTable
CREATE TABLE "addons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "status" "AddOnStatus" NOT NULL DEFAULT 'ACTIVE',
    "priceAmount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "billingInterval" "BillingInterval",
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_addons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "status" "SchoolAddOnStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(6),
    "priceAmount" DECIMAL(12,2),
    "currency" TEXT,
    "billingInterval" "BillingInterval",
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "school_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_apps" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "providerName" TEXT,
    "status" "MarketplaceAppStatus" NOT NULL DEFAULT 'ACTIVE',
    "documentationUrl" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "marketplace_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_marketplace_installations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "status" "MarketplaceInstallStatus" NOT NULL DEFAULT 'INSTALLED',
    "installedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMPTZ(6),
    "configuration" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "school_marketplace_installations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "addons_code_key" ON "addons"("code");

-- CreateIndex
CREATE INDEX "addons_status_idx" ON "addons"("status");

-- CreateIndex
CREATE INDEX "school_addons_tenantId_idx" ON "school_addons"("tenantId");

-- CreateIndex
CREATE INDEX "school_addons_addOnId_idx" ON "school_addons"("addOnId");

-- CreateIndex
CREATE INDEX "school_addons_schoolId_status_idx" ON "school_addons"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "school_addons_schoolId_addOnId_key" ON "school_addons"("schoolId", "addOnId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_apps_code_key" ON "marketplace_apps"("code");

-- CreateIndex
CREATE INDEX "marketplace_apps_status_idx" ON "marketplace_apps"("status");

-- CreateIndex
CREATE INDEX "marketplace_apps_category_idx" ON "marketplace_apps"("category");

-- CreateIndex
CREATE INDEX "school_marketplace_installations_tenantId_idx" ON "school_marketplace_installations"("tenantId");

-- CreateIndex
CREATE INDEX "school_marketplace_installations_appId_idx" ON "school_marketplace_installations"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "school_marketplace_installations_schoolId_appId_key" ON "school_marketplace_installations"("schoolId", "appId");

-- AddForeignKey
ALTER TABLE "school_addons" ADD CONSTRAINT "school_addons_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_addons" ADD CONSTRAINT "school_addons_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "addons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_marketplace_installations" ADD CONSTRAINT "school_marketplace_installations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_marketplace_installations" ADD CONSTRAINT "school_marketplace_installations_appId_fkey" FOREIGN KEY ("appId") REFERENCES "marketplace_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
