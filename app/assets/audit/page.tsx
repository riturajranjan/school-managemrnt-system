"use client";

import { ResourceAuditTrail } from "@/components/library/resource-audit-trail";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function AssetAuditPage() {
  const { can, role } = usePermissions();
  if (!can("assets.view")) return <PermissionDenied action="view the asset audit" role={roleLabels[role]} backHref="/assets" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Asset audit trail</h1>
        <p className="text-xs text-muted-foreground">Every asset creation, assignment, maintenance, depreciation and disposal event</p>
      </div>
      <ResourceAuditTrail domain="asset" />
    </div>
  );
}
