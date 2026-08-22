"use client";

// Inventory hub (Phase 9O) — headline stats are real (PostgreSQL/API); the
// quickLinks below still legitimately point at Purchases/Vendors, which stay
// fully mock (procurement/vendor systems are explicitly out of scope for
// this phase) — matching the Library/Transport hub precedent, so this page
// is a hybrid and is not itself in the migrated-route mock guard.
import Link from "next/link";
import { AlertTriangle, ArrowLeftRight, Boxes, ClipboardList, PackageSearch, Tags, TrendingDown, Truck, Undo2, Warehouse } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useInventoryDashboard } from "@/lib/hooks/api/use-inventory-api";
import { roleLabels } from "@/lib/permissions/roles";

const quickLinks = [
  { href: "/inventory/items", label: "Items", description: "Stock register with live quantities", icon: Boxes },
  { href: "/inventory/issues", label: "Issues", description: "Issue stock to staff, students and departments", icon: ClipboardList },
  { href: "/inventory/returns", label: "Returns", description: "Receive returned issued stock", icon: Undo2 },
  { href: "/inventory/transfers", label: "Transfers", description: "Move stock between locations", icon: ArrowLeftRight },
  { href: "/inventory/low-stock", label: "Low stock", description: "Reorder alerts and thresholds", icon: TrendingDown },
  { href: "/inventory/purchases", label: "Purchases", description: "Requests and procurement", icon: Truck },
  { href: "/inventory/vendors", label: "Vendors", description: "Supplier directory", icon: Warehouse },
  { href: "/inventory/stocktake", label: "Stocktake", description: "Physical count and variance", icon: PackageSearch },
  { href: "/inventory/categories", label: "Categories", description: "Item classification", icon: Tags },
  { href: "/inventory/reports", label: "Reports", description: "Stock-on-hand, low-stock and movement history", icon: ClipboardList },
];

export default function InventoryHubPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: summary } = useInventoryDashboard();
  if (!capabilitiesLoading && !hasServerPermission("inventory.view")) return <PermissionDenied action="view inventory" role={roleLabels[role]} backHref="/" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Inventory</h1>
        <p className="text-xs text-muted-foreground">Stock, procurement, issue/return and stock operations</p>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total items" value={String(summary?.totalItems ?? 0)} icon={Boxes} tone="neutral" />
        <StatTile label="Units on hand" value={String(summary?.totalUnitsOnHand ?? 0)} icon={Warehouse} tone="neutral" />
        <StatTile label="Low stock" value={String(summary?.lowStockCount ?? 0)} icon={TrendingDown} tone={(summary?.lowStockCount ?? 0) > 0 ? "warning" : "success"} />
        <StatTile label="Out of stock" value={String(summary?.outOfStockCount ?? 0)} icon={AlertTriangle} tone={(summary?.outOfStockCount ?? 0) > 0 ? "error" : "success"} />
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
