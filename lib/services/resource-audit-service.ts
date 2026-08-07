import { setState } from "@/lib/data/store";
import type { ResourceAuditAction, ResourceAuditDomain, ResourceAuditEvent } from "@/lib/types/resource-audit";
import { generateId } from "@/lib/utils";

const DEFAULT_TENANT = "default";
const DEFAULT_BRANCH = "main";

/** Every Phase 7 service that mutates library, inventory or asset state calls
 * this alongside its own setState — the same append-only single-log pattern as
 * logTransportAudit()/logFinancialAudit(), extended with a `domain` tag so the
 * three sub-modules can filter the shared log. */
export function logResourceAudit(entry: {
  domain: ResourceAuditDomain;
  subjectId?: string;
  action: ResourceAuditAction;
  actorName: string;
  actorRole: string;
  summary: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  branch?: string;
}) {
  const record: ResourceAuditEvent = {
    ...entry,
    id: generateId("raudit"),
    tenantId: DEFAULT_TENANT,
    branch: entry.branch ?? DEFAULT_BRANCH,
    createdAt: new Date().toISOString(),
  };
  setState((db) => ({ ...db, resourceAuditLog: [record, ...db.resourceAuditLog] }));
}
