-- CreateEnum
CREATE TYPE "PerformanceReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrainingProgramStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrainingParticipantStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewPeriodStart" DATE NOT NULL,
    "reviewPeriodEnd" DATE NOT NULL,
    "reviewDate" DATE,
    "status" "PerformanceReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "overallRating" INTEGER,
    "summary" TEXT,
    "comments" TEXT,
    "goals" TEXT,
    "visibleToEmployee" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "updatedByUserId" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_programs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "trainerName" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "TrainingProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "updatedByUserId" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_participants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "trainingProgramId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "status" "TrainingParticipantStatus" NOT NULL DEFAULT 'ASSIGNED',
    "completedAt" DATE,
    "certificateIssued" BOOLEAN NOT NULL DEFAULT false,
    "assignedByUserId" TEXT NOT NULL,
    "assignedByName" TEXT,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "training_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "performance_reviews_tenantId_idx" ON "performance_reviews"("tenantId");

-- CreateIndex
CREATE INDEX "performance_reviews_schoolId_staffId_idx" ON "performance_reviews"("schoolId", "staffId");

-- CreateIndex
CREATE INDEX "performance_reviews_schoolId_status_idx" ON "performance_reviews"("schoolId", "status");

-- CreateIndex
CREATE INDEX "performance_reviews_reviewerId_idx" ON "performance_reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "training_programs_tenantId_idx" ON "training_programs"("tenantId");

-- CreateIndex
CREATE INDEX "training_programs_schoolId_status_idx" ON "training_programs"("schoolId", "status");

-- CreateIndex
CREATE INDEX "training_participants_tenantId_idx" ON "training_participants"("tenantId");

-- CreateIndex
CREATE INDEX "training_participants_schoolId_staffId_idx" ON "training_participants"("schoolId", "staffId");

-- CreateIndex
CREATE INDEX "training_participants_trainingProgramId_idx" ON "training_participants"("trainingProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "training_participants_trainingProgramId_staffId_key" ON "training_participants"("trainingProgramId", "staffId");

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_participants" ADD CONSTRAINT "training_participants_trainingProgramId_fkey" FOREIGN KEY ("trainingProgramId") REFERENCES "training_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_participants" ADD CONSTRAINT "training_participants_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
