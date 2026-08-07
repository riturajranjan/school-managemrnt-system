"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { returnIssue } from "@/lib/services/inventory-service";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function InventoryReturnsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Storekeeper", role: roleLabels[role] };
  const [, force] = useState(0);
  if (!can("inventory.view")) return <PermissionDenied action="view returns" role={roleLabels[role]} backHref="/inventory" />;
  const canReturn = can("inventory.issue");

  const outstanding = db.inventoryIssues.filter((i) => i.returnable && i.status !== "returned");
  const itemName = (id: string) => db.inventoryItems.find((i) => i.id === id)?.name ?? id;

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
          {outstanding.map((issue) => {
            const remaining = issue.quantity - issue.returnedQuantity;
            return (
              <div key={issue.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{itemName(issue.itemId)}</p>
                  <p className="text-xs text-muted-foreground">{issue.recipientName} · {remaining} of {issue.quantity} outstanding · {formatDate(issue.issueDate)}</p>
                </div>
                <div className="flex items-center gap-xs">
                  <Badge tone="warning">{remaining} out</Badge>
                  {canReturn && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { returnIssue(issue.id, remaining, actor, "good"); force((n) => n + 1); }}>Return good</Button>
                      <Button size="sm" variant="ghost" onClick={() => { returnIssue(issue.id, remaining, actor, "damaged"); force((n) => n + 1); }}>Damaged</Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
