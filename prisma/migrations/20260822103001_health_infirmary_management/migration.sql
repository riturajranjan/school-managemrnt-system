-- CreateEnum
CREATE TYPE "HealthVisitStatus" AS ENUM ('OPEN', 'CLOSED', 'REFERRED');

-- CreateTable
CREATE TABLE "health_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT,
    "staffId" TEXT,
    "bloodGroup" TEXT,
    "allergiesText" TEXT,
    "chronicConditionsText" TEXT,
    "careInstructions" TEXT,
    "physicianName" TEXT,
    "physicianPhone" TEXT,
    "insuranceProvider" TEXT,
    "insuranceNumberMasked" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "health_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_visits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT,
    "staffId" TEXT,
    "reason" TEXT NOT NULL,
    "symptomsReported" TEXT,
    "observationNotes" TEXT,
    "careAction" TEXT,
    "guardianContacted" BOOLEAN NOT NULL DEFAULT false,
    "status" "HealthVisitStatus" NOT NULL DEFAULT 'OPEN',
    "referralDestination" TEXT,
    "referralNotes" TEXT,
    "followUpAt" TIMESTAMP(3),
    "attendedByStaffId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "health_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_vital_observations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "temperatureC" DOUBLE PRECISION,
    "pulseBpm" INTEGER,
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "oxygenSaturationPct" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_vital_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_treatment_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "administeredByStaffId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "administeredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_treatment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_medication_administrations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "notes" TEXT,
    "administeredByStaffId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "administeredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_medication_administrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "health_profiles_studentId_key" ON "health_profiles"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "health_profiles_staffId_key" ON "health_profiles"("staffId");

-- CreateIndex
CREATE INDEX "health_profiles_schoolId_idx" ON "health_profiles"("schoolId");

-- CreateIndex
CREATE INDEX "health_visits_schoolId_branchId_status_idx" ON "health_visits"("schoolId", "branchId", "status");

-- CreateIndex
CREATE INDEX "health_visits_studentId_idx" ON "health_visits"("studentId");

-- CreateIndex
CREATE INDEX "health_visits_staffId_idx" ON "health_visits"("staffId");

-- CreateIndex
CREATE INDEX "health_vital_observations_visitId_idx" ON "health_vital_observations"("visitId");

-- CreateIndex
CREATE INDEX "health_treatment_records_visitId_idx" ON "health_treatment_records"("visitId");

-- CreateIndex
CREATE INDEX "health_medication_administrations_visitId_idx" ON "health_medication_administrations"("visitId");

-- AddForeignKey
ALTER TABLE "health_profiles" ADD CONSTRAINT "health_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_profiles" ADD CONSTRAINT "health_profiles_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_visits" ADD CONSTRAINT "health_visits_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_visits" ADD CONSTRAINT "health_visits_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_visits" ADD CONSTRAINT "health_visits_attendedByStaffId_fkey" FOREIGN KEY ("attendedByStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_vital_observations" ADD CONSTRAINT "health_vital_observations_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "health_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_treatment_records" ADD CONSTRAINT "health_treatment_records_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "health_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_treatment_records" ADD CONSTRAINT "health_treatment_records_administeredByStaffId_fkey" FOREIGN KEY ("administeredByStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_medication_administrations" ADD CONSTRAINT "health_medication_administrations_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "health_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_medication_administrations" ADD CONSTRAINT "health_medication_administrations_administeredByStaffId_fkey" FOREIGN KEY ("administeredByStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
