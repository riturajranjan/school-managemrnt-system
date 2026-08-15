-- CreateEnum
CREATE TYPE "CurriculumStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TopicProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LessonPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "curricula" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CurriculumStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "curricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_units" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "plannedStart" DATE,
    "plannedEnd" DATE,
    "estimatedPeriods" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "curriculum_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_chapters" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "curriculum_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_topics" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "learningOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "curriculum_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_topic_progress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" "TopicProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completedAt" TIMESTAMPTZ(6),
    "completedByStaffId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "curriculum_topic_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_plans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "teachingAssignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "learningObjective" TEXT NOT NULL,
    "teachingMethod" TEXT NOT NULL,
    "materials" TEXT,
    "activity" TEXT,
    "homeworkNote" TEXT,
    "assessmentMethod" TEXT,
    "plannedDate" DATE NOT NULL,
    "period" INTEGER,
    "status" "LessonPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedByUserId" TEXT,
    "reviewedByName" TEXT,
    "reviewComment" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lesson_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_plan_topics" (
    "lessonPlanId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_plan_topics_pkey" PRIMARY KEY ("lessonPlanId","topicId")
);

-- CreateIndex
CREATE INDEX "curricula_tenantId_idx" ON "curricula"("tenantId");

-- CreateIndex
CREATE INDEX "curricula_classId_idx" ON "curricula"("classId");

-- CreateIndex
CREATE INDEX "curricula_subjectId_idx" ON "curricula"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "curricula_schoolId_academicSessionId_classId_subjectId_key" ON "curricula"("schoolId", "academicSessionId", "classId", "subjectId");

-- CreateIndex
CREATE INDEX "curriculum_units_curriculumId_idx" ON "curriculum_units"("curriculumId");

-- CreateIndex
CREATE INDEX "curriculum_chapters_unitId_idx" ON "curriculum_chapters"("unitId");

-- CreateIndex
CREATE INDEX "curriculum_topics_chapterId_idx" ON "curriculum_topics"("chapterId");

-- CreateIndex
CREATE INDEX "curriculum_topic_progress_tenantId_idx" ON "curriculum_topic_progress"("tenantId");

-- CreateIndex
CREATE INDEX "curriculum_topic_progress_sectionId_idx" ON "curriculum_topic_progress"("sectionId");

-- CreateIndex
CREATE INDEX "curriculum_topic_progress_topicId_idx" ON "curriculum_topic_progress"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_topic_progress_sectionId_topicId_key" ON "curriculum_topic_progress"("sectionId", "topicId");

-- CreateIndex
CREATE INDEX "lesson_plans_tenantId_idx" ON "lesson_plans"("tenantId");

-- CreateIndex
CREATE INDEX "lesson_plans_schoolId_academicSessionId_idx" ON "lesson_plans"("schoolId", "academicSessionId");

-- CreateIndex
CREATE INDEX "lesson_plans_sectionId_idx" ON "lesson_plans"("sectionId");

-- CreateIndex
CREATE INDEX "lesson_plans_subjectId_idx" ON "lesson_plans"("subjectId");

-- CreateIndex
CREATE INDEX "lesson_plans_staffId_idx" ON "lesson_plans"("staffId");

-- CreateIndex
CREATE INDEX "lesson_plans_status_idx" ON "lesson_plans"("status");

-- CreateIndex
CREATE INDEX "lesson_plans_plannedDate_idx" ON "lesson_plans"("plannedDate");

-- CreateIndex
CREATE INDEX "lesson_plan_topics_topicId_idx" ON "lesson_plan_topics"("topicId");

-- AddForeignKey
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_units" ADD CONSTRAINT "curriculum_units_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_chapters" ADD CONSTRAINT "curriculum_chapters_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "curriculum_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_topics" ADD CONSTRAINT "curriculum_topics_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "curriculum_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_topic_progress" ADD CONSTRAINT "curriculum_topic_progress_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_topic_progress" ADD CONSTRAINT "curriculum_topic_progress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "curriculum_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_topic_progress" ADD CONSTRAINT "curriculum_topic_progress_completedByStaffId_fkey" FOREIGN KEY ("completedByStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "teaching_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plan_topics" ADD CONSTRAINT "lesson_plan_topics_lessonPlanId_fkey" FOREIGN KEY ("lessonPlanId") REFERENCES "lesson_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plan_topics" ADD CONSTRAINT "lesson_plan_topics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "curriculum_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
