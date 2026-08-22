"use client";

// Cafeteria Command Centre (Phase 9T) — real PostgreSQL/API cutover. Order
// queue / feedback / low-stock panels are dropped (Orders/Inventory stay
// mock) and replaced with a real "Today's menus" panel + real item catalog
// count. No fabricated sales/revenue/wastage.
import Link from "next/link";
import { CalendarClock, Store, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { useShell } from "@/components/shell/shell-context";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useCafeteriaDashboard, useCafeteriaMenus } from "@/lib/hooks/api/use-cafeteria-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function CafeteriaDashboardPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { activeSession } = useShell();
  const { data: dashboard } = useCafeteriaDashboard();
  const today = new Date().toISOString().slice(0, 10);
  const { data: todaysMenus } = useCafeteriaMenus({ date: today });

  if (!capabilitiesLoading && !hasServerPermission("cafeteria.view")) return <PermissionDenied action="view the cafeteria command centre" role={roleLabels[role]} backHref="/cafeteria" />;
  const s = dashboard ?? { mealsServedToday: 0, studentMealsToday: 0, staffMealsToday: 0, activeItems: 0, menusToday: 0, locationCount: 0 };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Cafeteria Command Centre</h1><p className="text-xs text-muted-foreground">{activeSession}</p></div>
      <section className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Meals served" value={String(s.mealsServedToday)} icon={UtensilsCrossed} tone="neutral" />
        <StatTile label="Student meals" value={String(s.studentMealsToday)} tone="neutral" />
        <StatTile label="Staff meals" value={String(s.staffMealsToday)} tone="neutral" />
        <StatTile label="Active items" value={String(s.activeItems)} tone="info" />
        <StatTile label="Menus today" value={String(s.menusToday)} icon={CalendarClock} tone="neutral" />
        <StatTile label="Locations" value={String(s.locationCount)} icon={Store} tone="success" />
      </section>
      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Today&apos;s menus</h2><Link href="/cafeteria/menu" className="text-xs text-primary">Menu & planner →</Link></div>
        {todaysMenus.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">No menus published for today.</p> : (
          <div className="flex flex-col gap-xs">{todaysMenus.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{m.locationName}</p><p className="text-xs text-muted-foreground">{m.itemCount} item{m.itemCount === 1 ? "" : "s"}</p></div>
              <Badge tone="neutral">{m.mealType}</Badge>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}
