-- CreateEnum
CREATE TYPE "HostelGenderPolicy" AS ENUM ('BOYS', 'GIRLS', 'MIXED');

-- CreateEnum
CREATE TYPE "HostelStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HostelRoomStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HostelBedStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HostelAssignmentStatus" AS ENUM ('ACTIVE', 'VACATED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "HostelStaffRole" AS ENUM ('WARDEN', 'ASSISTANT_WARDEN');

-- CreateEnum
CREATE TYPE "HostelStaffAssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "HostelRollCallStatus" AS ENUM ('PRESENT', 'ABSENT', 'ON_LEAVE');

-- CreateTable
CREATE TABLE "hostels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "genderPolicy" "HostelGenderPolicy",
    "status" "HostelStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hostels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_rooms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "floorNumber" INTEGER,
    "roomType" TEXT,
    "facilities" TEXT[],
    "notes" TEXT,
    "status" "HostelRoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hostel_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_beds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bedNumber" TEXT NOT NULL,
    "status" "HostelBedStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hostel_beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_hostel_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vacatedAt" TIMESTAMPTZ(6),
    "status" "HostelAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedByUserId" TEXT NOT NULL,
    "vacatedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_hostel_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_staff_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "role" "HostelStaffRole" NOT NULL DEFAULT 'WARDEN',
    "status" "HostelStaffAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hostel_staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_roll_call_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "HostelRollCallStatus" NOT NULL,
    "markedByUserId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hostel_roll_call_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hostels_schoolId_status_idx" ON "hostels"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hostels_schoolId_code_key" ON "hostels"("schoolId", "code");

-- CreateIndex
CREATE INDEX "hostel_rooms_schoolId_status_idx" ON "hostel_rooms"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hostel_rooms_hostelId_roomNumber_key" ON "hostel_rooms"("hostelId", "roomNumber");

-- CreateIndex
CREATE INDEX "hostel_beds_schoolId_status_idx" ON "hostel_beds"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hostel_beds_roomId_bedNumber_key" ON "hostel_beds"("roomId", "bedNumber");

-- CreateIndex
CREATE INDEX "student_hostel_assignments_schoolId_studentId_idx" ON "student_hostel_assignments"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "student_hostel_assignments_schoolId_status_idx" ON "student_hostel_assignments"("schoolId", "status");

-- CreateIndex
CREATE INDEX "student_hostel_assignments_bedId_idx" ON "student_hostel_assignments"("bedId");

-- CreateIndex
CREATE INDEX "student_hostel_assignments_academicSessionId_idx" ON "student_hostel_assignments"("academicSessionId");

-- CreateIndex
CREATE INDEX "hostel_staff_assignments_schoolId_hostelId_idx" ON "hostel_staff_assignments"("schoolId", "hostelId");

-- CreateIndex
CREATE INDEX "hostel_staff_assignments_staffId_idx" ON "hostel_staff_assignments"("staffId");

-- CreateIndex
CREATE INDEX "hostel_roll_call_records_schoolId_hostelId_date_idx" ON "hostel_roll_call_records"("schoolId", "hostelId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "hostel_roll_call_records_studentId_date_key" ON "hostel_roll_call_records"("studentId", "date");

-- AddForeignKey
ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "hostel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_hostel_assignments" ADD CONSTRAINT "student_hostel_assignments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_hostel_assignments" ADD CONSTRAINT "student_hostel_assignments_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_hostel_assignments" ADD CONSTRAINT "student_hostel_assignments_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "hostel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_hostel_assignments" ADD CONSTRAINT "student_hostel_assignments_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "hostel_beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_staff_assignments" ADD CONSTRAINT "hostel_staff_assignments_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_staff_assignments" ADD CONSTRAINT "hostel_staff_assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_roll_call_records" ADD CONSTRAINT "hostel_roll_call_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_roll_call_records" ADD CONSTRAINT "hostel_roll_call_records_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
