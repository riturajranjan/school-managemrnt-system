"use client";

import Link from "next/link";
import { AlertTriangle, Boxes, ClipboardList, Store, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { useShell } from "@/components/shell/shell-context";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { cafeteriaSummary } from "@/lib/selectors/campus-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { mealCategoryLabels, orderStatusLabels, orderStatusTone } from "@/lib/types/cafeteria";
import { formatMoney } from "@/lib/finance/money";

export default function CafeteriaDashboardPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const { activeSession } = useShell();
  if (!can("cafeteria.view")) return <PermissionDenied action="view the cafeteria command centre" role={roleLabels[role]} backHref="/cafeteria" />;

  const s = cafeteriaSummary(db);
  const pending = db.cafeteriaOrders.filter((o) => o.status === "placed" || o.status === "preparing" || o.status === "ready").sort((a, b) => a.pickupTime.localeCompare(b.pickupTime)).slice(0, 6);
  const popular = db.menuItems.filter((m) => m.popular && m.available).slice(0, 5);
  const lowStock = db.cafeteriaInventory.filter((i) => i.status !== "in-stock");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Cafeteria Command Centre</h1><p className="text-xs text-muted-foreground">{activeSession}</p></div>
      <section className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Meals served" value={String(s.mealsServedMock)} icon={UtensilsCrossed} tone="neutral" />
        <StatTile label="Active counters" value={String(s.activeCounters)} icon={Store} tone="success" />
        <StatTile label="Meal plans" value={String(s.mealPlanUsers)} tone="info" />
        <StatTile label="Pending orders" value={String(s.pendingOrders)} icon={ClipboardList} tone={s.pendingOrders > 0 ? "warning" : "success"} />
        <StatTile label="Out of stock" value={String(s.outOfStock)} icon={AlertTriangle} tone={s.outOfStock > 0 ? "error" : "success"} />
        <StatTile label="Feedback" value={String(s.feedbackCount)} tone="neutral" />
      </section>
      <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-md lg:col-span-2">
          <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Order queue</h2><Link href="/cafeteria/orders" className="text-xs text-primary">All →</Link></div>
          {pending.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">No pending orders.</p> : (
            <div className="flex flex-col gap-xs">{pending.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{o.orderNumber} · {o.studentName}</p><p className="text-xs text-muted-foreground">{o.counter} · pickup {o.pickupTime} · {formatMoney(o.total)}</p></div><Badge tone={orderStatusTone[o.status]}>{orderStatusLabels[o.status]}</Badge></div>
            ))}</div>
          )}
        </div>
        <div className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Popular today</h2>
            <div className="flex flex-col gap-xs">{popular.map((m) => <div key={m.id} className="flex items-center justify-between text-sm"><span className="truncate text-foreground">{m.name}</span><span className="text-xs text-muted-foreground">{mealCategoryLabels[m.category]}</span></div>)}</div>
          </div>
          {lowStock.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/8 p-md"><p className="mb-1 flex items-center gap-1 text-sm font-medium text-warning"><Boxes className="size-4" /> Stock alerts</p><div className="flex flex-wrap gap-1">{lowStock.map((i) => <Badge key={i.id} tone={i.status === "out-of-stock" ? "error" : "warning"}>{i.name}</Badge>)}</div></div>
          )}
        </div>
      </div>
    </div>
  );
}
