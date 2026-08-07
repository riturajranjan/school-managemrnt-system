"use client";

import { useState } from "react";
import { CalendarRange, LayoutGrid, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { toggleMenuAvailability } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { dietaryTagLabels, mealCategoryLabels, type MealCategory } from "@/lib/types/cafeteria";
import { formatMoney } from "@/lib/finance/money";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const cats: MealCategory[] = ["breakfast", "lunch", "snacks", "dinner"];

export default function CafeteriaMenuPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [view, setView] = useState<"menu" | "planner">("menu");
  const [day, setDay] = useState("Mon");
  const [, force] = useState(0);
  if (!can("cafeteria.view")) return <PermissionDenied action="view the menu" role={roleLabels[role]} backHref="/cafeteria" />;
  const canManage = can("cafeteria.manage");
  const itemName = (id: string) => db.menuItems.find((m) => m.id === id)?.name ?? "";

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Menu & weekly planner</h1><p className="text-xs text-muted-foreground">{db.menuItems.length} items · dietary labels are informational, not medical guarantees</p></div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          <button onClick={() => setView("menu")} className={`flex items-center gap-1 rounded px-sm py-1.5 text-xs font-medium ${view === "menu" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><LayoutGrid className="size-3.5" /> Menu</button>
          <button onClick={() => setView("planner")} className={`flex items-center gap-1 rounded px-sm py-1.5 text-xs font-medium ${view === "planner" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><CalendarRange className="size-3.5" /> Weekly</button>
        </div>
      </div>

      {view === "menu" ? (
        <div className="flex flex-col gap-md">
          {cats.concat("a-la-carte" as MealCategory).map((cat) => {
            const items = db.menuItems.filter((m) => m.category === cat);
            if (items.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="mb-sm text-sm font-semibold text-foreground">{mealCategoryLabels[cat]}</h2>
                <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                  {items.map((m) => (
                    <div key={m.id} className={`surface-3d flex flex-col gap-1 rounded-lg border p-md ${m.available && !m.outOfStock ? "border-border bg-surface" : "border-border bg-surface-secondary/40"}`}>
                      <div className="flex items-start justify-between gap-sm">
                        <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{m.name}{m.popular && <span className="ml-1 text-xs text-warning">★</span>}</p><p className="truncate text-xs text-muted-foreground">{m.description}</p></div>
                        <span className="text-sm font-semibold text-foreground">{formatMoney(m.price)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">{m.dietaryTags.map((t) => <span key={t} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{dietaryTagLabels[t]}</span>)}</div>
                      <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{m.counter} · {m.servingTime}</span>{m.outOfStock ? <Badge tone="error">Out of stock</Badge> : canManage ? <Button size="sm" variant="ghost" onClick={() => { toggleMenuAvailability(m.id); force((n) => n + 1); }}>{m.available ? "Available" : "Hidden"}</Button> : <Badge tone={m.available ? "success" : "neutral"}>{m.available ? "Available" : "Off menu"}</Badge>}</div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div>
          {/* Mobile day selector */}
          <div className="mb-sm flex gap-1 overflow-x-auto sm:hidden">{days.map((d) => <button key={d} onClick={() => setDay(d)} className={`shrink-0 rounded-pill px-3 py-1 text-xs font-medium ${day === d ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{d}</button>)}</div>
          {/* Mobile single day */}
          <div className="flex flex-col gap-sm sm:hidden">
            {cats.map((cat) => { const slot = db.weeklyMenu.find((w) => w.day === day && w.category === cat); return (
              <div key={cat} className="rounded-lg border border-border bg-surface p-sm"><p className="text-xs font-semibold text-muted-foreground">{mealCategoryLabels[cat]}</p><p className="text-sm text-foreground">{slot ? slot.itemIds.map(itemName).join(", ") : "—"}</p></div>
            ); })}
          </div>
          {/* Desktop grid */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-sm font-semibold">Meal</th>{days.map((d) => <th key={d} className="p-sm font-semibold">{d}</th>)}</tr></thead>
              <tbody>{cats.map((cat) => (
                <tr key={cat} className="border-b border-border last:border-0"><td className="p-sm font-medium text-foreground">{mealCategoryLabels[cat]}</td>{days.map((d) => { const slot = db.weeklyMenu.find((w) => w.day === d && w.category === cat); return <td key={d} className="p-sm text-xs text-muted-foreground">{slot ? slot.itemIds.map(itemName).join(", ") : "—"}</td>; })}</tr>
              ))}</tbody>
            </table>
          </div>
          {canManage && <p className="mt-sm text-xs text-muted-foreground"><Utensils className="mr-1 inline size-3" /> Drag-to-plan, duplicate day and publish are frontend actions in a connected build.</p>}
        </div>
      )}
    </div>
  );
}
