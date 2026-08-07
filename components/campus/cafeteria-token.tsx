import { QrGlyph } from "@/components/library/code-label";
import { orderStatusLabels, orderStatusTone, type CafeteriaOrder } from "@/lib/types/cafeteria";
import { toneClasses } from "@/components/dashboard/tone";
import { formatMoney } from "@/lib/finance/money";
import { cn } from "@/lib/utils";

/** Dimensional digital canteen token. The QR encodes only the opaque token
 * code — never personal data. */
export function CafeteriaToken({ order }: { order: CafeteriaOrder }) {
  return (
    <div className="mx-auto w-full max-w-xs overflow-hidden rounded-xl border border-border bg-surface shadow-floating">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#022c43] to-[#18b0c8] px-md py-2 text-white">
        <span className="text-xs font-semibold uppercase tracking-wide">Canteen token</span>
        <span className="font-mono text-sm font-bold">{order.orderNumber}</span>
      </div>
      <div className="flex items-center gap-3 p-md">
        <QrGlyph value={order.tokenCode} size={80} />
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          <p className="truncate"><span className="text-foreground">{order.studentName}</span></p>
          <p>Counter: <span className="text-foreground">{order.counter}</span></p>
          <p>Pickup: <span className="text-foreground">{order.pickupTime}</span></p>
          <p>Total: <span className="text-foreground">{formatMoney(order.total)}</span></p>
          <span className={cn("mt-1 inline-flex rounded-pill px-2 py-0.5 text-[11px] font-medium", toneClasses[orderStatusTone[order.status]].soft)}>{orderStatusLabels[order.status]}</span>
        </div>
      </div>
      <div className="border-t border-dashed border-border px-md py-2">
        <ul className="text-xs text-muted-foreground">
          {order.items.map((it) => (
            <li key={it.menuItemId} className="flex justify-between"><span className="truncate">{it.quantity}× {it.name}</span><span>{formatMoney(it.price)}</span></li>
          ))}
        </ul>
      </div>
      <p className="px-md pb-2 text-[10px] text-muted-foreground">QR encodes an opaque token only — no personal data.</p>
    </div>
  );
}
