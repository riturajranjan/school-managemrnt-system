"use client";

// Asset audit trail (Phase 9O) — real AuditEvent feed across create/update/
// assign/return/status/maintenance events (replaces the pre-migration mock
// ResourceAuditTrail, which had zero real backing).
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAssetAuditFeed } from "@/lib/hooks/api/use-assets-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/utils";

export default function AssetAuditPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: events } = useAssetAuditFeed();

  if (!capabilitiesLoading && !hasServerPermission("assets.view")) return <PermissionDenied action="view the asset audit" role={roleLabels[role]} backHref="/assets" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Asset audit trail</h1>
        <p className="text-xs text-muted-foreground">Every asset creation, assignment, return, status change and maintenance event</p>
      </div>
      {!events || events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No audit events recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-xs">
          {events.map((e) => (
            <li key={e.id} className="surface-3d rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <span className="text-xs font-medium text-foreground">{e.action.replace(/_/g, " ")}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</span>
              </div>
              {e.actorName && <p className="mt-1 text-xs text-muted-foreground">{e.actorName}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
