"use client";

import { Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";

export default function InventoryCategoriesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("inventory.view"))
    return (
      <PermissionDenied
        action="view categories"
        role={roleLabels[role]}
        backHref="/inventory"
      />
    );

  return (
    <div className="mx-auto flex w-full  flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Inventory categories
        </h1>
        <p className="text-xs text-muted-foreground">
          Consumable and durable item classification
        </p>
      </div>

      <div className="flex flex-col gap-sm">
        {db.inventoryCategories.map((c) => {
          const count = db.inventoryItems.filter(
            (i) => i.categoryId === c.id,
          ).length;
          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center gap-sm">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Tags className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {c.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.consumable ? "Consumable" : "Durable / returnable"}
                  </p>
                </div>
              </div>
              <Badge tone="neutral">{count} item(s)</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
