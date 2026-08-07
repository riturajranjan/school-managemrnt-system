import { setState } from "@/lib/data/store";
import type { TransportAuditAction, TransportAuditEvent } from "@/lib/types/transport-audit";
import { generateId } from "@/lib/utils";

const DEFAULT_TENANT = "default";
const DEFAULT_BRANCH = "main";

/** Every Phase 6 service that mutates route, vehicle, driver, trip or safety
 * state calls this alongside its own setState — the same append-only
 * single-log pattern as logFinancialAudit()/logExamAudit(), applied to
 * transport. */
export function logTransportAudit(entry: {
  subjectId?: string;
  action: TransportAuditAction;
  actorName: string;
  actorRole: string;
  summary: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  branch?: string;
  tripId?: string;
}) {
  const record: TransportAuditEvent = {
    ...entry,
    id: generateId("taudit"),
    tenantId: DEFAULT_TENANT,
    branch: entry.branch ?? DEFAULT_BRANCH,
    createdAt: new Date().toISOString(),
  };
  setState((db) => ({ ...db, transportAuditLog: [record, ...db.transportAuditLog] }));
}
