"use client";

import { useResourceAudit } from "@/lib/hooks/use-library";
import { resourceAuditActionLabels, type ResourceAuditDomain } from "@/lib/types/resource-audit";
import { formatDateTime } from "@/lib/utils";

/** Read-only audit trail for a library/inventory/asset subject. Reads the shared
 * append-only resource audit log via the store hook. */
export function ResourceAuditTrail({ domain, subjectId }: { domain?: ResourceAuditDomain; subjectId?: string }) {
  const events = useResourceAudit(domain, subjectId);
  const sorted = [...events].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (sorted.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No audit events recorded yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-xs">
      {sorted.map((event) => (
        <li key={event.id} className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <div className="flex items-center justify-between gap-xs">
            <span className="text-xs font-medium text-foreground">{resourceAuditActionLabels[event.action]}</span>
            <span className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm text-foreground">{event.summary}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {event.actorName} · {event.actorRole}
            {event.reason ? ` · ${event.reason}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
