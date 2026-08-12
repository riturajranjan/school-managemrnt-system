-- CreateEnum
CREATE TYPE "DomainType" AS ENUM ('SUBDOMAIN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'DISABLED');

-- CreateTable
CREATE TABLE "school_feature_overrides" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "school_feature_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_domains" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "type" "DomainType" NOT NULL DEFAULT 'CUSTOM',
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verifiedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "school_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_brandings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "displayName" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "loginHeadline" TEXT,
    "loginSubheadline" TEXT,
    "footerText" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "school_brandings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_feature_overrides_schoolId_idx" ON "school_feature_overrides"("schoolId");

-- CreateIndex
CREATE INDEX "school_feature_overrides_tenantId_idx" ON "school_feature_overrides"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "school_feature_overrides_schoolId_featureKey_key" ON "school_feature_overrides"("schoolId", "featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "school_domains_hostname_key" ON "school_domains"("hostname");

-- CreateIndex
CREATE INDEX "school_domains_schoolId_idx" ON "school_domains"("schoolId");

-- CreateIndex
CREATE INDEX "school_domains_tenantId_idx" ON "school_domains"("tenantId");

-- CreateIndex
CREATE INDEX "school_domains_status_idx" ON "school_domains"("status");

-- CreateIndex
CREATE UNIQUE INDEX "school_brandings_schoolId_key" ON "school_brandings"("schoolId");

-- CreateIndex
CREATE INDEX "school_brandings_tenantId_idx" ON "school_brandings"("tenantId");

-- AddForeignKey
ALTER TABLE "school_feature_overrides" ADD CONSTRAINT "school_feature_overrides_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_domains" ADD CONSTRAINT "school_domains_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_brandings" ADD CONSTRAINT "school_brandings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
