"use client";

// Real client hooks for Document Studio (Phase 9V). Reads/writes the live
// /api/document-studio/* endpoints — no mock db.documentTemplates/
// generatedDocuments/idCards.
import { apiGet, apiPost, apiPatch, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  CreateDocumentTemplateRequest,
  DocumentStudioDashboardDto,
  DocumentTemplateDto,
  DocTypeDto,
  GenerateDocumentRequest,
  GeneratedDocumentDto,
  MergeFieldDto,
  PreviewDocumentRequest,
  PreviewDocumentResponse,
  UpdateDocumentTemplateRequest,
  VoidDocumentRequest,
} from "@/lib/api/contracts";

// ── Templates ────────────────────────────────────────────────────────────

export function useDocumentTemplates(filters: { docType?: DocTypeDto; status?: string; kind?: string } = {}) {
  return useApiList<DocumentTemplateDto>(`/api/document-studio/templates${buildQuery(filters)}`);
}
export function useDocumentTemplate(templateId: string | undefined) {
  return useApiResource<DocumentTemplateDto>(templateId ? `/api/document-studio/templates/${templateId}` : null);
}
export const createDocumentTemplateRequest = (body: CreateDocumentTemplateRequest): Promise<ApiResult<DocumentTemplateDto>> =>
  apiPost<DocumentTemplateDto>("/api/document-studio/templates", body);
export const updateDocumentTemplateRequest = (id: string, body: UpdateDocumentTemplateRequest): Promise<ApiResult<DocumentTemplateDto>> =>
  apiPatch<DocumentTemplateDto>(`/api/document-studio/templates/${id}`, body);
export const activateDocumentTemplateRequest = (id: string): Promise<ApiResult<DocumentTemplateDto>> =>
  apiPost<DocumentTemplateDto>(`/api/document-studio/templates/${id}/activate`, {});
export const archiveDocumentTemplateRequest = (id: string): Promise<ApiResult<DocumentTemplateDto>> =>
  apiPost<DocumentTemplateDto>(`/api/document-studio/templates/${id}/archive`, {});

export function useMergeFields(subjectType: "student" | "staff") {
  return useApiList<MergeFieldDto>(`/api/document-studio/merge-fields?subjectType=${subjectType}`);
}

// ── Generate / preview ───────────────────────────────────────────────────

export const previewDocumentRequest = (body: PreviewDocumentRequest): Promise<ApiResult<PreviewDocumentResponse>> =>
  apiPost<PreviewDocumentResponse>("/api/document-studio/preview", body);
export const generateDocumentRequest = (body: GenerateDocumentRequest): Promise<ApiResult<GeneratedDocumentDto>> =>
  apiPost<GeneratedDocumentDto>("/api/document-studio/generate", body);

// ── History ──────────────────────────────────────────────────────────────

export function useGeneratedDocuments(filters: { docType?: DocTypeDto; studentId?: string; staffId?: string; status?: string; q?: string } = {}) {
  return useApiList<GeneratedDocumentDto>(`/api/document-studio/documents${buildQuery(filters)}`);
}
export function useGeneratedDocument(documentId: string | undefined) {
  return useApiResource<GeneratedDocumentDto>(documentId ? `/api/document-studio/documents/${documentId}` : null);
}
export const voidDocumentRequest = (documentId: string, body: VoidDocumentRequest): Promise<ApiResult<GeneratedDocumentDto>> =>
  apiPost<GeneratedDocumentDto>(`/api/document-studio/documents/${documentId}/void`, body);

// ── Dashboard ────────────────────────────────────────────────────────────

export function useDocumentStudioDashboard() {
  return useApiResource<DocumentStudioDashboardDto>("/api/document-studio/dashboard");
}

// ── Student 360 / Staff ──────────────────────────────────────────────────

export function useStudentGeneratedDocuments(studentId: string) {
  return useApiList<GeneratedDocumentDto>(`/api/students/${studentId}/generated-documents`);
}
export function useStaffGeneratedDocuments(staffId: string) {
  return useApiList<GeneratedDocumentDto>(`/api/staff/${staffId}/generated-documents`);
}

export { apiGet };
