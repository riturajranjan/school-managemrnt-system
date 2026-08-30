-- CreateEnum
CREATE TYPE "JobOpeningStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobApplicantStage" AS ENUM ('APPLIED', 'SCREENING', 'INTERVIEW', 'SELECTED', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EmployeeOnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "HrPolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "job_openings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" TEXT,
    "designationId" TEXT,
    "employmentType" "EmploymentType",
    "openings" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "requirements" TEXT,
    "publishDate" DATE,
    "closingDate" DATE,
    "status" "JobOpeningStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "updatedByUserId" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "job_openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applicants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "jobOpeningId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "stage" "JobApplicantStage" NOT NULL DEFAULT 'APPLIED',
    "appliedDate" DATE NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "updatedByUserId" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "job_applicants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_onboardings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "jobApplicantId" TEXT,
    "hrOwnerStaffId" TEXT,
    "startDate" DATE NOT NULL,
    "expectedCompletionDate" DATE,
    "status" "EmployeeOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "updatedByUserId" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeOnboardingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMPTZ(6),
    "completedByUserId" TEXT,
    "completedByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "content" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveDate" DATE,
    "status" "HrPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "updatedByUserId" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hr_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_policy_acknowledgements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "hrPolicyId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_policy_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "breakMinutes" INTEGER,
    "workingDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "updatedByUserId" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveUntil" DATE,
    "assignedByUserId" TEXT NOT NULL,
    "assignedByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_openings_tenantId_idx" ON "job_openings"("tenantId");
CREATE INDEX "job_openings_schoolId_status_idx" ON "job_openings"("schoolId", "status");
CREATE INDEX "job_openings_departmentId_idx" ON "job_openings"("departmentId");

-- CreateIndex
CREATE INDEX "job_applicants_tenantId_idx" ON "job_applicants"("tenantId");
CREATE INDEX "job_applicants_schoolId_stage_idx" ON "job_applicants"("schoolId", "stage");
CREATE INDEX "job_applicants_jobOpeningId_idx" ON "job_applicants"("jobOpeningId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_onboardings_jobApplicantId_key" ON "employee_onboardings"("jobApplicantId");
CREATE INDEX "employee_onboardings_tenantId_idx" ON "employee_onboardings"("tenantId");
CREATE INDEX "employee_onboardings_schoolId_status_idx" ON "employee_onboardings"("schoolId", "status");
CREATE INDEX "employee_onboardings_staffId_idx" ON "employee_onboardings"("staffId");

-- CreateIndex
CREATE INDEX "onboarding_tasks_tenantId_idx" ON "onboarding_tasks"("tenantId");
CREATE INDEX "onboarding_tasks_employeeOnboardingId_idx" ON "onboarding_tasks"("employeeOnboardingId");

-- CreateIndex
CREATE INDEX "hr_policies_tenantId_idx" ON "hr_policies"("tenantId");
CREATE INDEX "hr_policies_schoolId_status_idx" ON "hr_policies"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_policy_acknowledgements_hrPolicyId_staffId_key" ON "staff_policy_acknowledgements"("hrPolicyId", "staffId");
CREATE INDEX "staff_policy_acknowledgements_tenantId_idx" ON "staff_policy_acknowledgements"("tenantId");
CREATE INDEX "staff_policy_acknowledgements_staffId_idx" ON "staff_policy_acknowledgements"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_schoolId_name_key" ON "shifts"("schoolId", "name");
CREATE INDEX "shifts_tenantId_idx" ON "shifts"("tenantId");
CREATE INDEX "shifts_schoolId_status_idx" ON "shifts"("schoolId", "status");

-- CreateIndex
CREATE INDEX "shift_assignments_tenantId_idx" ON "shift_assignments"("tenantId");
CREATE INDEX "shift_assignments_shiftId_idx" ON "shift_assignments"("shiftId");
CREATE INDEX "shift_assignments_staffId_idx" ON "shift_assignments"("staffId");

-- AddForeignKey
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applicants" ADD CONSTRAINT "job_applicants_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "job_openings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_jobApplicantId_fkey" FOREIGN KEY ("jobApplicantId") REFERENCES "job_applicants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_hrOwnerStaffId_fkey" FOREIGN KEY ("hrOwnerStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_employeeOnboardingId_fkey" FOREIGN KEY ("employeeOnboardingId") REFERENCES "employee_onboardings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_policy_acknowledgements" ADD CONSTRAINT "staff_policy_acknowledgements_hrPolicyId_fkey" FOREIGN KEY ("hrPolicyId") REFERENCES "hr_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_policy_acknowledgements" ADD CONSTRAINT "staff_policy_acknowledgements_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
