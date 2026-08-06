import { getSnapshot, setState } from "@/lib/data/store";
import type { ReportCard, ReportCardSection, ReportCardTemplate } from "@/lib/types/report-cards";
import { generateId } from "@/lib/utils";
import { logExamAudit } from "./exam-audit-service";

export type ReportCardTemplateInput = Omit<ReportCardTemplate, "id" | "createdAt" | "updatedAt">;

export function createReportCardTemplate(data: ReportCardTemplateInput): ReportCardTemplate {
  const now = new Date().toISOString();
  const template: ReportCardTemplate = { ...data, id: generateId("rct"), createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, reportCardTemplates: [...db.reportCardTemplates, template] }));
  return template;
}

export function updateReportCardTemplate(templateId: string, patch: Partial<Omit<ReportCardTemplate, "id">>) {
  setState((db) => ({
    ...db,
    reportCardTemplates: db.reportCardTemplates.map((t) => (t.id === templateId ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)),
  }));
}

export function setTemplateSections(templateId: string, sections: ReportCardSection[]) {
  updateReportCardTemplate(templateId, { sections });
}

export function duplicateTemplate(templateId: string): ReportCardTemplate | null {
  const db = getSnapshot();
  const source = db.reportCardTemplates.find((t) => t.id === templateId);
  if (!source) return null;
  return createReportCardTemplate({ ...source, name: `${source.name} (copy)`, status: "draft" });
}

/** Non-blocking batch generation: commits in small chunks via setTimeout so the UI stays
 * responsive and can show live progress, rather than freezing on one giant setState. */
export function generateReportCards(
  examId: string,
  templateId: string,
  scope: "single" | "class" | "section" | "all",
  studentIds: string[],
  actor: { name: string; role: string },
  onProgress?: (completed: number, total: number) => void,
): Promise<{ jobId: string; completed: number; failed: number }> {
  const jobId = generateId("rcgj");
  const now = new Date().toISOString();
  setState((db) => ({
    ...db,
    reportCardGenerationJobs: [
      ...db.reportCardGenerationJobs,
      { id: jobId, examId, templateId, scope, studentIds, total: studentIds.length, completed: 0, failed: 0, status: "running", createdBy: actor.name, createdAt: now },
    ],
  }));

  return new Promise((resolve) => {
    const batchSize = 5;
    let index = 0;
    let completed = 0;
    let failed = 0;

    function processBatch() {
      const db = getSnapshot();
      const batch = studentIds.slice(index, index + batchSize);
      const newCards: ReportCard[] = [];

      for (const studentId of batch) {
        const hasResult = db.examResults.some((r) => r.examId === examId && r.studentId === studentId);
        if (!hasResult) {
          failed += 1;
          continue;
        }
        const existing = db.reportCards.find((rc) => rc.examId === examId && rc.studentId === studentId);
        newCards.push({
          id: existing?.id ?? generateId("rc"),
          examId,
          studentId,
          templateId,
          version: (existing?.version ?? 0) + 1,
          status: "generated",
          generatedAt: new Date().toISOString(),
          generatedBy: actor.name,
        });
        completed += 1;
      }

      setState((current) => ({
        ...current,
        reportCards: [...current.reportCards.filter((rc) => !newCards.some((nc) => nc.studentId === rc.studentId && nc.examId === rc.examId)), ...newCards],
        reportCardGenerationJobs: current.reportCardGenerationJobs.map((j) => (j.id === jobId ? { ...j, completed, failed } : j)),
      }));

      index += batchSize;
      onProgress?.(completed + failed, studentIds.length);

      if (index < studentIds.length) {
        setTimeout(processBatch, 120);
      } else {
        setState((current) => ({
          ...current,
          reportCardGenerationJobs: current.reportCardGenerationJobs.map((j) => (j.id === jobId ? { ...j, status: failed > 0 ? "completed-with-errors" : "completed", finishedAt: new Date().toISOString() } : j)),
        }));
        logExamAudit({ examId, action: "report-card-generated", actorName: actor.name, actorRole: actor.role, summary: `Generated ${completed} report card(s)${failed > 0 ? `, ${failed} skipped (no result yet)` : ""}.` });
        resolve({ jobId, completed, failed });
      }
    }

    processBatch();
  });
}

export function publishReportCard(reportCardId: string, actor: { name: string; role: string }) {
  setState((db) => ({ ...db, reportCards: db.reportCards.map((rc) => (rc.id === reportCardId ? { ...rc, status: "published", publishedAt: new Date().toISOString() } : rc)) }));
  logExamAudit({ actorName: actor.name, actorRole: actor.role, action: "report-card-generated", summary: "Report card published." });
}

export function revokeReportCard(reportCardId: string, actor: { name: string; role: string }) {
  setState((db) => ({ ...db, reportCards: db.reportCards.map((rc) => (rc.id === reportCardId ? { ...rc, status: "revoked", revokedAt: new Date().toISOString() } : rc)) }));
  logExamAudit({ actorName: actor.name, actorRole: actor.role, action: "publication-revoked", summary: "Report card revoked." });
}
