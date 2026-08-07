"use client";

import Link from "next/link";
import { CalendarDays, Coffee, Soup, Utensils, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";

export default function HostelMessPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hostel.view")) return <PermissionDenied action="view the hostel mess" role={roleLabels[role]} backHref="/hostel" />;

  const today = new Date().toISOString().slice(0, 10);
  const todayMess = db.hostelMess.find((m) => m.date === today) ?? db.hostelMess[0];
  const lowStock = db.cafeteriaInventory.filter((i) => i.status !== "in-stock");

  const meals = todayMess ? [
    { icon: Coffee, meal: todayMess.breakfast },
    { icon: Utensils, meal: todayMess.lunch },
    { icon: Soup, meal: todayMess.snacks },
    { icon: UtensilsCrossed, meal: todayMess.dinner },
  ] : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Hostel mess</h1><p className="text-xs text-muted-foreground">Today&apos;s menu · {todayMess ? `${todayMess.attendanceMock}/${todayMess.expectedStudents} expected` : ""}</p></div>
        <Button asChild size="sm" variant="outline"><Link href="/cafeteria/menu"><Utensils className="size-3.5" /> Cafeteria menu</Link></Button>
      </div>

      {todayMess?.specialMenu && <div className="rounded-md border border-primary/25 bg-primary/5 p-sm text-sm text-primary">🎉 {todayMess.specialMenu}</div>}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        {meals.map(({ icon: Icon, meal }, i) => (
          <div key={i} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" /></span><p className="text-sm font-semibold text-foreground">{meal.name}</p></div>
            <ul className="flex flex-wrap gap-1">{meal.items.map((it) => <li key={it} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs text-muted-foreground">{it}</li>)}</ul>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/8 p-md">
          <p className="mb-1 flex items-center gap-1 text-sm font-medium text-warning"><CalendarDays className="size-4" /> Inventory warnings</p>
          <div className="flex flex-wrap gap-1">{lowStock.map((i) => <Badge key={i.id} tone={i.status === "out-of-stock" ? "error" : "warning"}>{i.name} — {i.status}</Badge>)}</div>
        </div>
      )}
    </div>
  );
}
