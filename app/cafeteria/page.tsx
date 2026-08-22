"use client";

// Cafeteria hub (Phase 9T) — real PostgreSQL/API cutover for stat tiles.
// Meal plans/Orders/Inventory/Feedback stay mock (deferred — no real
// payment/ordering/ingredient-BOM/feedback infrastructure exists; see
// route-mock-guard.test.ts for the full reasoning).
import Link from "next/link";
import { Boxes, CalendarRange, ClipboardList, Gauge, MessageSquare, ScrollText, Store, Utensils, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useCafeteriaDashboard } from "@/lib/hooks/api/use-cafeteria-api";
import { roleLabels } from "@/lib/permissions/roles";

const links = [
  { href: "/cafeteria/menu", label: "Menu & planner", description: "Menu items and weekly plan", icon: Utensils },
  { href: "/cafeteria/meal-plans", label: "Meal plans", description: "Plans and enrollment", icon: CalendarRange },
  { href: "/cafeteria/orders", label: "Orders", description: "Order queue and tokens", icon: ClipboardList },
  { href: "/cafeteria/counters", label: "Locations", description: "Serving locations", icon: Store },
  { href: "/cafeteria/inventory", label: "Inventory", description: "Stock levels (mock)", icon: Boxes },
  { href: "/cafeteria/feedback", label: "Feedback", description: "Diner feedback", icon: MessageSquare },
  { href: "/cafeteria/reports", label: "Reports", description: "Meals, orders and waste", icon: ScrollText },
];

export default function CafeteriaHubPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: dashboard } = useCafeteriaDashboard();
  if (!capabilitiesLoading && !hasServerPermission("cafeteria.view")) return <PermissionDenied action="view the cafeteria" role={roleLabels[role]} backHref="/campus-life" />;
  const s = dashboard ?? { mealsServedToday: 0, activeItems: 0, menusToday: 0, locationCount: 0 };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Cafeteria</h1><p className="text-xs text-muted-foreground">Menu, meal plans, orders and locations</p></div>
        <Button asChild size="sm"><Link href="/cafeteria/dashboard"><Gauge className="size-3.5" /> Command Centre</Link></Button>
      </div>
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Meals served today" value={String(s.mealsServedToday)} icon={UtensilsCrossed} tone="neutral" />
        <StatTile label="Active items" value={String(s.activeItems)} tone="info" />
        <StatTile label="Menus today" value={String(s.menusToday)} tone="neutral" />
        <StatTile label="Locations" value={String(s.locationCount)} tone="success" />
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {links.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" /></span>
            <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{label}</p><p className="truncate text-xs text-muted-foreground">{description}</p></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
