-- CreateEnum
CREATE TYPE "DocumentTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentTemplateKind" AS ENUM ('ID_CARD', 'STUDENT_CERTIFICATE', 'STAFF_CERTIFICATE');

-- CreateEnum
CREATE TYPE "DocumentSubjectType" AS ENUM ('STUDENT', 'STAFF');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('STUDENT_ID', 'STAFF_ID', 'BONAFIDE_CERTIFICATE', 'STUDY_CERTIFICATE', 'ACHIEVEMENT_CERTIFICATE', 'EMPLOYMENT_CERTIFICATE');

-- CreateEnum
CREATE TYPE "GeneratedDocumentStatus" AS ENUM ('GENERATED', 'VOID');

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "DocumentTemplateKind" NOT NULL,
    "docType" "DocumentType" NOT NULL,
    "subjectType" "DocumentSubjectType" NOT NULL,
    "status" "DocumentTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "contentJson" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "subjectType" "DocumentSubjectType" NOT NULL,
    "studentId" TEXT,
    "staffId" TEXT,
    "documentNumber" TEXT NOT NULL,
    "sourceSnapshotJson" JSONB NOT NULL,
    "renderedSnapshot" JSONB NOT NULL,
    "status" "GeneratedDocumentStatus" NOT NULL DEFAULT 'GENERATED',
    "generatedByUserId" TEXT NOT NULL,
    "generatedByName" TEXT NOT NULL,
    "generatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMPTZ(6),
    "voidReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_number_counters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "docType" "DocumentType" NOT NULL,
    "year" INTEGER NOT NULL,
    "nextSeq" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "document_number_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_templates_tenantId_idx" ON "document_templates"("tenantId");

-- CreateIndex
CREATE INDEX "document_templates_schoolId_docType_status_idx" ON "document_templates"("schoolId", "docType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_schoolId_code_key" ON "document_templates"("schoolId", "code");

-- CreateIndex
CREATE INDEX "generated_documents_tenantId_idx" ON "generated_documents"("tenantId");

-- CreateIndex
CREATE INDEX "generated_documents_schoolId_studentId_idx" ON "generated_documents"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "generated_documents_schoolId_staffId_idx" ON "generated_documents"("schoolId", "staffId");

-- CreateIndex
CREATE INDEX "generated_documents_templateId_idx" ON "generated_documents"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "generated_documents_schoolId_documentNumber_key" ON "generated_documents"("schoolId", "documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "document_number_counters_schoolId_docType_year_key" ON "document_number_counters"("schoolId", "docType", "year");

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "document_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
