"use client";

import { Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { mealCategoryLabels } from "@/lib/types/cafeteria";

export default function CountersPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("cafeteria.view")) return <PermissionDenied action="view counters" role={roleLabels[role]} backHref="/cafeteria" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Counters</h1><p className="text-xs text-muted-foreground">{db.cafeteriaCounters.filter((c) => c.active).length} active</p></div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {db.cafeteriaCounters.map((c) => (
          <div key={c.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-start justify-between gap-sm"><div className="flex items-center gap-sm"><span className={`flex size-9 items-center justify-center rounded-md ${c.active ? "bg-success/10 text-success" : "bg-surface-secondary text-muted-foreground"}`}><Store className="size-4" /></span><p className="text-sm font-semibold text-foreground">{c.name}</p></div><Badge tone={c.active ? "success" : "neutral"}>{c.active ? "Open" : "Closed"}</Badge></div>
            <div className="flex flex-wrap gap-1">{c.categories.map((cat) => <span key={cat} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs text-muted-foreground">{mealCategoryLabels[cat]}</span>)}</div>
            {c.active && <p className="text-xs text-muted-foreground">Queue: <span className={c.queueMock > 8 ? "text-warning" : "text-foreground"}>{c.queueMock}</span></p>}
          </div>
        ))}
      </div>
    </div>
  );
}
