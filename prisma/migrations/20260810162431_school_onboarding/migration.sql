-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "school_onboarding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStep" TEXT NOT NULL,
    "completedSteps" TEXT[],
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "school_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_onboarding_schoolId_key" ON "school_onboarding"("schoolId");

-- CreateIndex
CREATE INDEX "school_onboarding_tenantId_idx" ON "school_onboarding"("tenantId");

-- CreateIndex
CREATE INDEX "school_onboarding_status_idx" ON "school_onboarding"("status");

-- AddForeignKey
ALTER TABLE "school_onboarding" ADD CONSTRAINT "school_onboarding_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
