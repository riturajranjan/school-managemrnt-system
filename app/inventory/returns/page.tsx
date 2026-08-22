"use client";

// Inventory returns (Phase 9O) — real PostgreSQL/API cutover.
import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { returnIssueRequest, useInventoryIssues } from "@/lib/hooks/api/use-inventory-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function InventoryReturnsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: issues, reload } = useInventoryIssues({ outstandingOnly: true });
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("inventory.view")) return <PermissionDenied action="view returns" role={roleLabels[role]} backHref="/inventory" />;
  const canReturn = hasServerPermission("inventory.manage");

  const outstanding = issues.filter((i) => i.returnable);

  async function handleReturn(issueId: string, quantity: number, condition: "good" | "damaged") {
    setBusyId(issueId);
    await returnIssueRequest(issueId, { quantity, condition });
    setBusyId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Returns</h1>
        <p className="text-xs text-muted-foreground">Receive returnable issued stock — good returns re-enter the ledger</p>
      </div>

      {outstanding.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Undo2 className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No returnable issues outstanding.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {outstanding.map((issue) => (
            <div key={issue.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{issue.itemName}</p>
                <p className="text-xs text-muted-foreground">{issue.recipientName} · {issue.outstandingQuantity} of {issue.quantity} outstanding</p>
              </div>
              <div className="flex items-center gap-xs">
                <Badge tone="warning">{issue.outstandingQuantity} out</Badge>
                {canReturn && (
                  <>
                    <Button size="sm" variant="outline" disabled={busyId === issue.id} onClick={() => handleReturn(issue.id, issue.outstandingQuantity, "good")}>Return good</Button>
                    <Button size="sm" variant="ghost" disabled={busyId === issue.id} onClick={() => handleReturn(issue.id, issue.outstandingQuantity, "damaged")}>Damaged</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
