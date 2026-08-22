"use client";

// Inventory categories (Phase 9O) — real PostgreSQL/API cutover. `category`
// is plain text on InventoryItem (no independent category CRUD existed
// pre-migration, per the phase's own guidance) — this lists the distinct
// values in use and how many items carry each.
import { Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useInventoryCategories } from "@/lib/hooks/api/use-inventory-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function InventoryCategoriesPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: categories } = useInventoryCategories();

  if (!capabilitiesLoading && !hasServerPermission("inventory.view")) {
    return <PermissionDenied action="view categories" role={roleLabels[role]} backHref="/inventory" />;
  }

  return (
    <div className="mx-auto flex w-full  flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Inventory categories</h1>
        <p className="text-xs text-muted-foreground">Item classification in use across the catalog</p>
      </div>

      {!categories || categories.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No categories yet — set a category when creating an item.</p>
      ) : (
        <div className="flex flex-col gap-sm">
          {categories.map((c) => (
            <div key={c.category} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center gap-sm">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Tags className="size-4" />
                </span>
                <p className="text-sm font-medium text-foreground">{c.category}</p>
              </div>
              <Badge tone="neutral">{c.count} item(s)</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
