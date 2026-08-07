"use client";

import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { mealCategoryLabels, mealPlanTypeLabels, orderStatusLabels, orderStatusTone } from "@/lib/types/cafeteria";
import { formatMoney } from "@/lib/finance/money";

export default function ParentCafeteriaPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("cafeteria.viewOwn") && !can("cafeteria.view")) return <PermissionDenied action="view the cafeteria" role={roleLabels[role]} backHref="/" />;

  const child = db.students[0];
  const enrollment = child ? db.mealPlanEnrollments.find((e) => e.studentId === child.id && e.status === "active") : undefined;
  const plan = enrollment ? db.mealPlans.find((p) => p.id === enrollment.planId) : undefined;
  const orders = child ? db.cafeteriaOrders.filter((o) => o.studentId === child.id) : [];
  const today = new Date().toISOString().slice(0, 10);
  const todayMenu = db.hostelMess.find((m) => m.date === today) ?? db.hostelMess[0];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><UtensilsCrossed className="size-4" /></span><div><h1 className="text-lg font-semibold text-foreground">Cafeteria — {child?.profile.firstName}</h1><p className="text-xs text-muted-foreground">Menu, meal plan and order history</p></div></div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Meal plan</h2>
        {plan ? (
          <div className="flex items-center justify-between gap-sm"><div><p className="text-sm font-medium text-foreground">{plan.name}</p><p className="text-xs text-muted-foreground">{mealPlanTypeLabels[plan.type]} · {plan.durationLabel} · {formatMoney(plan.price)}</p></div><Badge tone="success">Active</Badge></div>
        ) : <p className="text-sm text-muted-foreground">No active meal plan.</p>}
      </div>

      {todayMenu && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Today&apos;s menu</h2><Link href="/cafeteria/menu" className="text-xs text-primary">Weekly →</Link></div>
          <div className="grid grid-cols-2 gap-sm text-sm">
            <div><p className="text-xs text-muted-foreground">{mealCategoryLabels.breakfast}</p><p className="text-foreground">{todayMenu.breakfast.items.join(", ")}</p></div>
            <div><p className="text-xs text-muted-foreground">{mealCategoryLabels.lunch}</p><p className="text-foreground">{todayMenu.lunch.items.join(", ")}</p></div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Order history</h2>
        {orders.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">No orders yet.</p> : (
          <div className="flex flex-col gap-xs">{orders.slice(0, 10).map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm"><span className="min-w-0 truncate text-foreground">{o.orderNumber} · {o.items.map((it) => it.name).join(", ")}</span><span className="flex items-center gap-2 text-xs text-muted-foreground">{formatMoney(o.total)} <Badge tone={orderStatusTone[o.status]}>{orderStatusLabels[o.status]}</Badge></span></div>
          ))}</div>
        )}
      </div>
    </div>
  );
}
