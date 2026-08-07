"use client";

import { CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { mealCategoryLabels, mealPlanTypeLabels } from "@/lib/types/cafeteria";
import { formatMoney } from "@/lib/finance/money";

export default function MealPlansPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("cafeteria.view")) return <PermissionDenied action="view meal plans" role={roleLabels[role]} backHref="/cafeteria" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Meal plans</h1><p className="text-xs text-muted-foreground">{db.mealPlans.length} plans</p></div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        {db.mealPlans.map((p) => (
          <div key={p.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-start justify-between gap-sm">
              <div className="flex items-center gap-sm"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><CalendarRange className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{mealPlanTypeLabels[p.type]} · {p.durationLabel}</p></div></div>
              <Badge tone={p.status === "active" ? "success" : "neutral"}>{p.status}</Badge>
            </div>
            <div className="flex flex-wrap gap-1">{p.meals.map((m) => <span key={m} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs text-muted-foreground">{mealCategoryLabels[m]}</span>)}</div>
            <div className="flex items-center justify-between text-sm"><span className="font-semibold text-foreground">{formatMoney(p.price)}</span><span className="text-xs text-muted-foreground">{p.enrolledCount} enrolled</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
