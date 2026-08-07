"use client";

import { useState } from "react";
import { ClipboardList, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { CafeteriaToken } from "@/components/campus/cafeteria-token";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setOrderStatus } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { orderStatusLabels, orderStatusTone, type CafeteriaOrder, type OrderStatus } from "@/lib/types/cafeteria";
import { formatMoney } from "@/lib/finance/money";

const flow: OrderStatus[] = ["placed", "preparing", "ready", "collected"];

export default function CafeteriaOrdersPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [token, setToken] = useState<CafeteriaOrder | null>(null);
  const [, force] = useState(0);
  if (!can("cafeteria.view")) return <PermissionDenied action="view orders" role={roleLabels[role]} backHref="/cafeteria" />;
  const canManage = can("cafeteria.manage");
  const rows = [...db.cafeteriaOrders].sort((a, b) => Number(a.status === "collected" || a.status === "cancelled") - Number(b.status === "collected" || b.status === "cancelled") || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Orders</h1><p className="text-xs text-muted-foreground">{db.cafeteriaOrders.filter((o) => o.status === "placed" || o.status === "preparing" || o.status === "ready").length} in progress</p></div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><ClipboardList className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No orders.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((o) => {
            const next = flow[Math.min(flow.indexOf(o.status) + 1, flow.length - 1)];
            return (
              <div key={o.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{o.orderNumber} · {o.studentName}</p><p className="truncate text-xs text-muted-foreground">{o.items.map((it) => `${it.quantity}× ${it.name}`).join(", ")} · {formatMoney(o.total)} · pickup {o.pickupTime}</p></div>
                <div className="flex shrink-0 items-center gap-xs">
                  <Badge tone={orderStatusTone[o.status]}>{orderStatusLabels[o.status]}</Badge>
                  <Button size="icon" variant="ghost" aria-label="View token" onClick={() => setToken(o)}><QrCode className="size-4" /></Button>
                  {canManage && flow.includes(o.status) && o.status !== "collected" && <Button size="sm" variant="outline" onClick={() => { setOrderStatus(o.id, next); force((n) => n + 1); }}>{next === "preparing" ? "Prepare" : next === "ready" ? "Ready" : "Collected"}</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <DetailDrawer open={token !== null} onOpenChange={(o) => !o && setToken(null)} title="Canteen token" description="Digital pickup token">
        {token && <CafeteriaToken order={token} />}
      </DetailDrawer>
    </div>
  );
}
