import { setState } from "@/lib/data/store";
import type { FinancialAuditAction, FinancialAuditEvent } from "@/lib/types/finance-audit";
import { generateId } from "@/lib/utils";

const DEFAULT_TENANT = "default";
const DEFAULT_BRANCH = "main";

/** Every Phase 5 service that mutates fee, accounting or payroll state calls
 * this alongside its own setState — the same append-only single-log pattern
 * as logExamAudit(), applied to money. */
export function logFinancialAudit(entry: {
  subjectId?: string;
  action: FinancialAuditAction;
  actorName: string;
  actorRole: string;
  summary: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  branch?: string;
  session?: string;
}) {
  const record: FinancialAuditEvent = {
    ...entry,
    id: generateId("faudit"),
    tenantId: DEFAULT_TENANT,
    branch: entry.branch ?? DEFAULT_BRANCH,
    createdAt: new Date().toISOString(),
  };
  setState((db) => ({ ...db, financialAuditLog: [record, ...db.financialAuditLog] }));
}
