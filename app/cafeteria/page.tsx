"use client";

import Link from "next/link";
import { Boxes, CalendarRange, ClipboardList, Gauge, MessageSquare, ScrollText, Store, Utensils, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { cafeteriaSummary } from "@/lib/selectors/campus-brief";
import { roleLabels } from "@/lib/permissions/roles";

const links = [
  { href: "/cafeteria/menu", label: "Menu & planner", description: "Menu items and weekly plan", icon: Utensils },
  { href: "/cafeteria/meal-plans", label: "Meal plans", description: "Plans and enrollment", icon: CalendarRange },
  { href: "/cafeteria/orders", label: "Orders", description: "Order queue and tokens", icon: ClipboardList },
  { href: "/cafeteria/counters", label: "Counters", description: "Live counter status", icon: Store },
  { href: "/cafeteria/inventory", label: "Inventory", description: "Stock levels (mock)", icon: Boxes },
  { href: "/cafeteria/feedback", label: "Feedback", description: "Diner feedback", icon: MessageSquare },
  { href: "/cafeteria/reports", label: "Reports", description: "Meals, orders and waste", icon: ScrollText },
];

export default function CafeteriaHubPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("cafeteria.view")) return <PermissionDenied action="view the cafeteria" role={roleLabels[role]} backHref="/campus-life" />;
  const s = cafeteriaSummary(db);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Cafeteria</h1><p className="text-xs text-muted-foreground">Menu, meal plans, orders and counters</p></div>
        <Button asChild size="sm"><Link href="/cafeteria/dashboard"><Gauge className="size-3.5" /> Command Centre</Link></Button>
      </div>
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Meals served" value={String(s.mealsServedMock)} icon={UtensilsCrossed} tone="neutral" />
        <StatTile label="Meal plans" value={String(s.mealPlanUsers)} tone="info" />
        <StatTile label="Pending orders" value={String(s.pendingOrders)} tone={s.pendingOrders > 0 ? "warning" : "success"} />
        <StatTile label="Out of stock" value={String(s.outOfStock)} tone={s.outOfStock > 0 ? "error" : "success"} />
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
