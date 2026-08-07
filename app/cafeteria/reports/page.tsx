"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { cafeteriaSummary } from "@/lib/selectors/campus-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { mealCategoryLabels, orderStatusLabels, type MealCategory, type OrderStatus } from "@/lib/types/cafeteria";
import { downloadTextFile } from "@/lib/utils";

export default function CafeteriaReportsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("cafeteria.view")) return <PermissionDenied action="view cafeteria reports" role={roleLabels[role]} backHref="/cafeteria" />;

  const s = cafeteriaSummary(db);
  const byStatus = new Map<OrderStatus, number>();
  for (const o of db.cafeteriaOrders) byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);
  // Menu utilisation (orders per category).
  const byCat = new Map<MealCategory, number>();
  for (const o of db.cafeteriaOrders) for (const it of o.items) { const cat = db.menuItems.find((m) => m.id === it.menuItemId)?.category; if (cat) byCat.set(cat, (byCat.get(cat) ?? 0) + it.quantity); }
  const maxCat = Math.max(1, ...byCat.values());
  const wasteMock = Math.round(db.cafeteriaOrders.length * 0.06);

  function exportSummary() {
    const lines = ["Metric,Value", `Meals served,${s.mealsServedMock}`, `Meal plan users,${s.mealPlanUsers}`, `Pending orders,${s.pendingOrders}`, `Out of stock,${s.outOfStock}`, `Food waste (mock),${wasteMock}`];
    downloadTextFile("cafeteria-report.csv", lines.join("\n"));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Cafeteria reports</h1><p className="text-xs text-muted-foreground">Meals, orders, utilisation and waste</p></div>
        <Button size="sm" variant="outline" onClick={exportSummary}><Download className="size-3.5" /> Export</Button>
      </div>
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Meals served" value={String(s.mealsServedMock)} tone="neutral" />
        <StatTile label="Meal plans" value={String(s.mealPlanUsers)} tone="info" />
        <StatTile label="Orders" value={String(db.cafeteriaOrders.length)} tone="neutral" />
        <StatTile label="Food waste (mock)" value={`${wasteMock}`} tone="warning" />
      </div>
      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Menu utilisation</h2>
          <div className="flex flex-col gap-sm">{[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
            <div key={cat} className="flex flex-col gap-1"><div className="flex items-center justify-between text-sm"><span className="text-foreground">{mealCategoryLabels[cat]}</span><span className="text-muted-foreground">{count}</span></div><MiniBar percent={(count / maxCat) * 100} toneClassName="bg-primary" /></div>
          ))}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Orders by status</h2>
          <div className="flex flex-col gap-xs">{[...byStatus.entries()].map(([st, count]) => (
            <div key={st} className="flex items-center justify-between text-sm"><span className="text-foreground">{orderStatusLabels[st]}</span><span className="text-muted-foreground">{count}</span></div>
          ))}</div>
        </div>
      </div>
    </div>
  );
}
