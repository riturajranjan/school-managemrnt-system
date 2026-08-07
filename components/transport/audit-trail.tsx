import { transportAuditActionLabels, type TransportAuditEvent } from "@/lib/types/transport-audit";
import { formatDateTime } from "@/lib/utils";

export function TransportAuditTrail({ events }: { events: TransportAuditEvent[] }) {
  const sorted = [...events].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (sorted.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No audit events recorded yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-xs">
      {sorted.map((event) => (
        <li key={event.id} className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <div className="flex items-center justify-between gap-xs">
            <span className="text-xs font-medium text-foreground">{transportAuditActionLabels[event.action]}</span>
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
