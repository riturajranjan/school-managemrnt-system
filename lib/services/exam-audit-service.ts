import { setState } from "@/lib/data/store";
import type { ExamAuditAction, ExamAuditEntry } from "@/lib/types/exams";
import { generateId } from "@/lib/utils";

/** Every Phase 4 service that mutates exam-domain state calls this alongside its own setState — kept as a single, append-only log rather than scattering ad-hoc history fields per entity. */
export function logExamAudit(entry: {
  examId?: string;
  action: ExamAuditAction;
  actorName: string;
  actorRole: string;
  summary: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
}) {
  const record: ExamAuditEntry = { ...entry, id: generateId("audit"), createdAt: new Date().toISOString() };
  setState((db) => ({ ...db, examAuditLog: [record, ...db.examAuditLog] }));
}
