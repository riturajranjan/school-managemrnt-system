"use client";

import { Boxes } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";

const tone: Record<string, "success" | "warning" | "error"> = { "in-stock": "success", "low-stock": "warning", "out-of-stock": "error" };

export default function CafeteriaInventoryPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("cafeteria.view")) return <PermissionDenied action="view cafeteria inventory" role={roleLabels[role]} backHref="/cafeteria" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Cafeteria inventory</h1><p className="text-xs text-muted-foreground">Mock stock levels · {db.cafeteriaInventory.filter((i) => i.status !== "in-stock").length} need attention</p></div>
      <div className="flex flex-col gap-sm">
        {db.cafeteriaInventory.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center gap-sm"><span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary"><Boxes className="size-4" /></span><div><p className="text-sm font-medium text-foreground">{i.name}</p><p className="text-xs text-muted-foreground">{i.quantity} {i.unit} · reorder at {i.reorderLevel}</p></div></div>
            <Badge tone={tone[i.status]}>{i.status.replace("-", " ")}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
