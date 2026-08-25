-- CreateEnum
CREATE TYPE "TransportIncidentType" AS ENUM ('BREAKDOWN', 'ACCIDENT', 'DELAY', 'SAFETY_CONCERN', 'BEHAVIOUR', 'OTHER');

-- CreateEnum
CREATE TYPE "TransportIncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TransportIncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TransportMaintenanceType" AS ENUM ('ROUTINE_SERVICE', 'REPAIR', 'INSPECTION', 'TYRE', 'BATTERY', 'OTHER');

-- CreateEnum
CREATE TYPE "TransportMaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransportDocumentSubjectType" AS ENUM ('VEHICLE', 'STAFF');

-- CreateEnum
CREATE TYPE "TransportDocumentType" AS ENUM ('INSURANCE', 'REGISTRATION', 'FITNESS_CERTIFICATE', 'PERMIT', 'POLLUTION_CERTIFICATE', 'DRIVING_LICENSE', 'POLICE_VERIFICATION', 'MEDICAL_CERTIFICATE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TRANSPORT_ALERT';

-- CreateTable
CREATE TABLE "transport_incidents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "routeId" TEXT,
    "tripId" TEXT,
    "type" "TransportIncidentType" NOT NULL,
    "severity" "TransportIncidentSeverity" NOT NULL,
    "status" "TransportIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "immediateAction" TEXT,
    "resolution" TEXT,
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "authorityNotified" BOOLEAN NOT NULL DEFAULT false,
    "reportedByUserId" TEXT NOT NULL,
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transport_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_maintenance_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "TransportMaintenanceType" NOT NULL,
    "status" "TransportMaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledDate" DATE NOT NULL,
    "completedDate" DATE,
    "vendor" TEXT,
    "odometerKm" INTEGER,
    "partsCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "labourCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transport_maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_fuel_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "odometerKm" INTEGER NOT NULL,
    "quantityLitres" DECIMAL(8,2) NOT NULL,
    "ratePerLitre" DECIMAL(8,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "vendor" TEXT,
    "filledByName" TEXT,
    "fullTank" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_fuel_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "subjectType" "TransportDocumentSubjectType" NOT NULL,
    "vehicleId" TEXT,
    "staffId" TEXT,
    "type" "TransportDocumentType" NOT NULL,
    "documentNumber" TEXT,
    "expiryDate" DATE,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transport_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transport_incidents_tenantId_idx" ON "transport_incidents"("tenantId");

-- CreateIndex
CREATE INDEX "transport_incidents_schoolId_status_idx" ON "transport_incidents"("schoolId", "status");

-- CreateIndex
CREATE INDEX "transport_incidents_vehicleId_idx" ON "transport_incidents"("vehicleId");

-- CreateIndex
CREATE INDEX "transport_maintenance_records_tenantId_idx" ON "transport_maintenance_records"("tenantId");

-- CreateIndex
CREATE INDEX "transport_maintenance_records_schoolId_status_idx" ON "transport_maintenance_records"("schoolId", "status");

-- CreateIndex
CREATE INDEX "transport_maintenance_records_vehicleId_idx" ON "transport_maintenance_records"("vehicleId");

-- CreateIndex
CREATE INDEX "transport_fuel_logs_tenantId_idx" ON "transport_fuel_logs"("tenantId");

-- CreateIndex
CREATE INDEX "transport_fuel_logs_schoolId_date_idx" ON "transport_fuel_logs"("schoolId", "date");

-- CreateIndex
CREATE INDEX "transport_fuel_logs_vehicleId_idx" ON "transport_fuel_logs"("vehicleId");

-- CreateIndex
CREATE INDEX "transport_documents_tenantId_idx" ON "transport_documents"("tenantId");

-- CreateIndex
CREATE INDEX "transport_documents_schoolId_idx" ON "transport_documents"("schoolId");

-- CreateIndex
CREATE INDEX "transport_documents_vehicleId_idx" ON "transport_documents"("vehicleId");

-- CreateIndex
CREATE INDEX "transport_documents_staffId_idx" ON "transport_documents"("staffId");

-- AddForeignKey
ALTER TABLE "transport_incidents" ADD CONSTRAINT "transport_incidents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "transport_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_incidents" ADD CONSTRAINT "transport_incidents_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_incidents" ADD CONSTRAINT "transport_incidents_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "transport_trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_maintenance_records" ADD CONSTRAINT "transport_maintenance_records_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "transport_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_fuel_logs" ADD CONSTRAINT "transport_fuel_logs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "transport_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_documents" ADD CONSTRAINT "transport_documents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "transport_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_documents" ADD CONSTRAINT "transport_documents_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
