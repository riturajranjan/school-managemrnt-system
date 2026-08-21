-- CreateEnum
CREATE TYPE "TransportVehicleType" AS ENUM ('BUS', 'MINI_BUS', 'VAN', 'CAR', 'ELECTRIC_VEHICLE', 'CONTRACT_VEHICLE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TransportVehicleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TransportShift" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'BOTH');

-- CreateEnum
CREATE TYPE "TransportRouteDirection" AS ENUM ('PICKUP', 'DROP', 'BOTH');

-- CreateEnum
CREATE TYPE "TransportRouteStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TransportStopStatus" AS ENUM ('ACTIVE', 'TEMPORARY', 'UNSAFE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TransportAssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "StudentTransportStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TransportTripType" AS ENUM ('PICKUP', 'DROP');

-- CreateEnum
CREATE TYPE "TransportTripStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransportTripStopStatus" AS ENUM ('PENDING', 'ARRIVED', 'DEPARTED');

-- CreateEnum
CREATE TYPE "TransportBoardingStatus" AS ENUM ('EXPECTED', 'BOARDED', 'ABSENT');

-- CreateEnum
CREATE TYPE "TransportDropStatus" AS ENUM ('ONBOARD', 'DROPPED');

-- CreateTable
CREATE TABLE "transport_vehicles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "displayName" TEXT,
    "type" "TransportVehicleType" NOT NULL DEFAULT 'BUS',
    "make" TEXT,
    "model" TEXT,
    "capacity" INTEGER NOT NULL,
    "status" "TransportVehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transport_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_routes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shift" "TransportShift" NOT NULL DEFAULT 'MORNING',
    "direction" "TransportRouteDirection" NOT NULL DEFAULT 'BOTH',
    "capacity" INTEGER,
    "status" "TransportRouteStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transport_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_stops" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "landmark" TEXT,
    "status" "TransportStopStatus" NOT NULL DEFAULT 'ACTIVE',
    "safetyNotes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transport_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_route_stops" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "pickupTime" TEXT,
    "dropTime" TEXT,

    CONSTRAINT "transport_route_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_route_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverStaffId" TEXT,
    "attendantStaffId" TEXT,
    "status" "TransportAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transport_route_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_transport_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "routeId" TEXT NOT NULL,
    "pickupStopId" TEXT NOT NULL,
    "dropStopId" TEXT NOT NULL,
    "status" "StudentTransportStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_transport_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_transport_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "pickupStopId" TEXT NOT NULL,
    "status" "StudentTransportStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_transport_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_trips" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverStaffId" TEXT,
    "attendantStaffId" TEXT,
    "date" DATE NOT NULL,
    "type" "TransportTripType" NOT NULL,
    "status" "TransportTripStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transport_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_trip_stops" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "TransportTripStopStatus" NOT NULL DEFAULT 'PENDING',
    "arrivedAt" TIMESTAMPTZ(6),
    "departedAt" TIMESTAMPTZ(6),

    CONSTRAINT "transport_trip_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_trip_students" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "boardingStatus" "TransportBoardingStatus" NOT NULL DEFAULT 'EXPECTED',
    "dropStatus" "TransportDropStatus" NOT NULL DEFAULT 'ONBOARD',
    "boardedAt" TIMESTAMPTZ(6),
    "droppedAt" TIMESTAMPTZ(6),
    "markedByUserId" TEXT,

    CONSTRAINT "transport_trip_students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transport_vehicles_tenantId_idx" ON "transport_vehicles"("tenantId");

-- CreateIndex
CREATE INDEX "transport_vehicles_schoolId_status_idx" ON "transport_vehicles"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transport_vehicles_schoolId_registrationNumber_key" ON "transport_vehicles"("schoolId", "registrationNumber");

-- CreateIndex
CREATE INDEX "transport_routes_tenantId_idx" ON "transport_routes"("tenantId");

-- CreateIndex
CREATE INDEX "transport_routes_schoolId_status_idx" ON "transport_routes"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transport_routes_schoolId_code_key" ON "transport_routes"("schoolId", "code");

-- CreateIndex
CREATE INDEX "transport_stops_tenantId_idx" ON "transport_stops"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_stops_schoolId_code_key" ON "transport_stops"("schoolId", "code");

-- CreateIndex
CREATE INDEX "transport_route_stops_tenantId_idx" ON "transport_route_stops"("tenantId");

-- CreateIndex
CREATE INDEX "transport_route_stops_routeId_sequence_idx" ON "transport_route_stops"("routeId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "transport_route_stops_routeId_stopId_key" ON "transport_route_stops"("routeId", "stopId");

-- CreateIndex
CREATE INDEX "transport_route_assignments_tenantId_idx" ON "transport_route_assignments"("tenantId");

-- CreateIndex
CREATE INDEX "transport_route_assignments_routeId_status_idx" ON "transport_route_assignments"("routeId", "status");

-- CreateIndex
CREATE INDEX "transport_route_assignments_vehicleId_idx" ON "transport_route_assignments"("vehicleId");

-- CreateIndex
CREATE INDEX "student_transport_assignments_tenantId_idx" ON "student_transport_assignments"("tenantId");

-- CreateIndex
CREATE INDEX "student_transport_assignments_schoolId_academicSessionId_st_idx" ON "student_transport_assignments"("schoolId", "academicSessionId", "status");

-- CreateIndex
CREATE INDEX "student_transport_assignments_routeId_idx" ON "student_transport_assignments"("routeId");

-- CreateIndex
CREATE INDEX "student_transport_assignments_studentId_idx" ON "student_transport_assignments"("studentId");

-- CreateIndex
CREATE INDEX "staff_transport_assignments_tenantId_idx" ON "staff_transport_assignments"("tenantId");

-- CreateIndex
CREATE INDEX "staff_transport_assignments_staffId_idx" ON "staff_transport_assignments"("staffId");

-- CreateIndex
CREATE INDEX "transport_trips_tenantId_idx" ON "transport_trips"("tenantId");

-- CreateIndex
CREATE INDEX "transport_trips_schoolId_date_idx" ON "transport_trips"("schoolId", "date");

-- CreateIndex
CREATE INDEX "transport_trips_vehicleId_idx" ON "transport_trips"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_trips_routeId_date_type_key" ON "transport_trips"("routeId", "date", "type");

-- CreateIndex
CREATE INDEX "transport_trip_stops_tripId_sequence_idx" ON "transport_trip_stops"("tripId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "transport_trip_stops_tripId_stopId_key" ON "transport_trip_stops"("tripId", "stopId");

-- CreateIndex
CREATE INDEX "transport_trip_students_tripId_idx" ON "transport_trip_students"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_trip_students_tripId_studentId_key" ON "transport_trip_students"("tripId", "studentId");

-- AddForeignKey
ALTER TABLE "transport_route_stops" ADD CONSTRAINT "transport_route_stops_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_route_stops" ADD CONSTRAINT "transport_route_stops_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "transport_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_route_assignments" ADD CONSTRAINT "transport_route_assignments_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_route_assignments" ADD CONSTRAINT "transport_route_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "transport_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_route_assignments" ADD CONSTRAINT "transport_route_assignments_driverStaffId_fkey" FOREIGN KEY ("driverStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_route_assignments" ADD CONSTRAINT "transport_route_assignments_attendantStaffId_fkey" FOREIGN KEY ("attendantStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transport_assignments" ADD CONSTRAINT "student_transport_assignments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transport_assignments" ADD CONSTRAINT "student_transport_assignments_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transport_assignments" ADD CONSTRAINT "student_transport_assignments_pickupStopId_fkey" FOREIGN KEY ("pickupStopId") REFERENCES "transport_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transport_assignments" ADD CONSTRAINT "student_transport_assignments_dropStopId_fkey" FOREIGN KEY ("dropStopId") REFERENCES "transport_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_transport_assignments" ADD CONSTRAINT "staff_transport_assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_transport_assignments" ADD CONSTRAINT "staff_transport_assignments_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_transport_assignments" ADD CONSTRAINT "staff_transport_assignments_pickupStopId_fkey" FOREIGN KEY ("pickupStopId") REFERENCES "transport_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_trips" ADD CONSTRAINT "transport_trips_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_trips" ADD CONSTRAINT "transport_trips_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "transport_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_trips" ADD CONSTRAINT "transport_trips_driverStaffId_fkey" FOREIGN KEY ("driverStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_trips" ADD CONSTRAINT "transport_trips_attendantStaffId_fkey" FOREIGN KEY ("attendantStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_trip_stops" ADD CONSTRAINT "transport_trip_stops_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "transport_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_trip_stops" ADD CONSTRAINT "transport_trip_stops_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "transport_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_trip_students" ADD CONSTRAINT "transport_trip_students_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "transport_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_trip_students" ADD CONSTRAINT "transport_trip_students_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_trip_students" ADD CONSTRAINT "transport_trip_students_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "student_transport_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_trip_students" ADD CONSTRAINT "transport_trip_students_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "transport_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
