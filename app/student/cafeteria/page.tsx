"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { CafeteriaToken } from "@/components/campus/cafeteria-token";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { placeOrder } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { dietaryTagLabels, mealCategoryLabels, type CafeteriaOrder, type MealCategory } from "@/lib/types/cafeteria";
import { addMoney, formatMoney, zeroMoney } from "@/lib/finance/money";

const cats: MealCategory[] = ["breakfast", "lunch", "snacks", "a-la-carte"];

export default function StudentCafeteriaPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [cat, setCat] = useState<MealCategory>("lunch");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [placed, setPlaced] = useState<CafeteriaOrder | null>(null);

  if (!can("cafeteria.viewOwn") && !can("cafeteria.view")) return <PermissionDenied action="view the cafeteria" role={roleLabels[role]} backHref="/" />;
  const canOrder = can("cafeteria.order");
  const me = db.students[0];
  const items = db.menuItems.filter((m) => m.category === cat && m.available && !m.outOfStock);
  const cartItems = Object.entries(cart).filter(([, q]) => q > 0).map(([id, q]) => { const m = db.menuItems.find((x) => x.id === id)!; return { menuItemId: id, name: m.name, quantity: q, price: m.price }; });
  const total = cartItems.reduce((sum, it) => addMoney(sum, { minorUnits: it.price.minorUnits * it.quantity, currency: "INR" }), zeroMoney("INR"));

  function add(id: string) { setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 })); }
  function remove(id: string) { setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) - 1) })); }
  function checkout() {
    const r = placeOrder({ studentName: me ? `${me.profile.firstName} ${me.profile.lastName}` : "Student", studentId: me?.id, items: cartItems, counter: db.menuItems.find((m) => m.id === cartItems[0]?.menuItemId)?.counter ?? "Main", pickupTime: "13:00" });
    if (r.ok && r.order) { setPlaced(r.order); setCart({}); }
  }

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Order food</h1><p className="text-xs text-muted-foreground">Frontend simulation · no real payment</p></div>
      <div className="flex gap-1 overflow-x-auto">{cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-pill px-3 py-1 text-xs font-medium ${cat === c ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{mealCategoryLabels[c]}</button>)}</div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><UtensilsCrossed className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">Nothing available in this category right now.</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {items.map((m) => (
            <div key={m.id} className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{m.name}</p><p className="truncate text-xs text-muted-foreground">{m.description}</p><div className="mt-1 flex flex-wrap gap-1">{m.dietaryTags.slice(0, 2).map((t) => <span key={t} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{dietaryTagLabels[t]}</span>)}</div></div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-semibold text-foreground">{formatMoney(m.price)}</span>
                {canOrder && ((cart[m.id] ?? 0) > 0 ? (
                  <div className="flex items-center gap-1"><Button size="icon" variant="outline" aria-label="Remove" onClick={() => remove(m.id)}><Minus className="size-3.5" /></Button><span className="w-5 text-center text-sm font-medium text-foreground">{cart[m.id]}</span><Button size="icon" variant="outline" aria-label="Add" onClick={() => add(m.id)}><Plus className="size-3.5" /></Button></div>
                ) : <Button size="sm" onClick={() => add(m.id)}><Plus className="size-3.5" /> Add</Button>)}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Dietary labels are informational and do not guarantee allergen safety.</p>

      {/* Sticky cart bar */}
      {canOrder && cartItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 mx-auto flex max-w-3xl items-center justify-between gap-sm border-t border-border bg-surface px-md py-3 shadow-floating sm:bottom-4 sm:rounded-lg sm:border">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground"><ShoppingCart className="size-4" /> {cartItems.reduce((s, it) => s + it.quantity, 0)} item(s) · {formatMoney(total)}</span>
          <Button onClick={checkout}>Place order</Button>
        </div>
      )}

      <DetailDrawer open={placed !== null} onOpenChange={(o) => !o && setPlaced(null)} title="Order placed" description="Your canteen token">
        {placed && <div className="flex flex-col gap-sm"><Badge tone="success" className="w-fit">Order placed</Badge><CafeteriaToken order={placed} /></div>}
      </DetailDrawer>
    </div>
  );
}
