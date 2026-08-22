"use client";

// Menu & weekly planner (Phase 9T) — real PostgreSQL/API cutover. The
// planner's days are real calendar dates (today .. today+6), not abstract
// weekday labels — menu identity is always location+date+mealType, never a
// generic "Mon/Tue" slot. Meal service (recording who was served) is
// embedded in the planner's per-slot drawer, since a service record always
// belongs to one real published menu.
import { useMemo, useState } from "react";
import { CalendarRange, LayoutGrid, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import {
  createCafeteriaItemRequest,
  createCafeteriaMenuRequest,
  recordCafeteriaMealRequest,
  setCafeteriaMenuItemsRequest,
  updateCafeteriaItemRequest,
  useCafeteriaItems,
  useCafeteriaLocations,
  useCafeteriaMeals,
  useCafeteriaMenu,
  useCafeteriaMenus,
} from "@/lib/hooks/api/use-cafeteria-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { CafeteriaMealTypeDto } from "@/lib/api/contracts";
import { formatMoney, moneyFromMinor } from "@/lib/finance/money";

const MEAL_TYPES: CafeteriaMealTypeDto[] = ["breakfast", "lunch", "snacks", "dinner", "a-la-carte"];
const MEAL_TYPE_LABEL: Record<CafeteriaMealTypeDto, string> = { breakfast: "Breakfast", lunch: "Lunch", snacks: "Snacks", dinner: "Dinner", "a-la-carte": "A la carte" };

function next7Dates(): string[] {
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10); });
}

export default function CafeteriaMenuPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [view, setView] = useState<"menu" | "planner">("menu");
  const [addingItem, setAddingItem] = useState(false);
  const { data: items, reload: reloadItems } = useCafeteriaItems({ status: "active" });
  const { data: locations } = useCafeteriaLocations({ status: "active" });
  const location = locations[0];
  const dates = useMemo(() => next7Dates(), []);
  const { data: menus, reload: reloadMenus } = useCafeteriaMenus(location ? { locationId: location.id, dateFrom: dates[0], dateTo: dates[6] } : {});
  const [cell, setCell] = useState<{ date: string; mealType: CafeteriaMealTypeDto } | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("cafeteria.view")) return <PermissionDenied action="view the menu" role={roleLabels[role]} backHref="/cafeteria" />;
  const canManage = hasServerPermission("cafeteria.manage");

  const grouped = items.reduce<Record<string, typeof items>>((acc, m) => {
    const key = m.category ?? "Uncategorized";
    (acc[key] ??= []).push(m);
    return acc;
  }, {});

  function menuFor(date: string, mealType: CafeteriaMealTypeDto) {
    return menus.find((m) => m.date === date && m.mealType === mealType);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Menu & weekly planner</h1><p className="text-xs text-muted-foreground">{items.length} items · dietary labels are informational, not medical guarantees</p></div>
        <div className="flex items-center gap-sm">
          {canManage && view === "menu" && <Button size="sm" variant="outline" onClick={() => setAddingItem(true)}><Plus className="size-3.5" /> Add item</Button>}
          <div className="inline-flex rounded-md border border-border p-0.5">
            <button onClick={() => setView("menu")} className={`flex items-center gap-1 rounded px-sm py-1.5 text-xs font-medium ${view === "menu" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><LayoutGrid className="size-3.5" /> Menu</button>
            <button onClick={() => setView("planner")} className={`flex items-center gap-1 rounded px-sm py-1.5 text-xs font-medium ${view === "planner" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><CalendarRange className="size-3.5" /> Weekly</button>
          </div>
        </div>
      </div>

      {view === "menu" ? (
        <div className="flex flex-col gap-md">
          {Object.entries(grouped).map(([cat, catItems]) => (
            <section key={cat}>
              <h2 className="mb-sm text-sm font-semibold text-foreground capitalize">{cat}</h2>
              <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                {catItems.map((m) => (
                  <div key={m.id} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-md">
                    <div className="flex items-start justify-between gap-sm">
                      <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{m.name}</p>{m.description && <p className="truncate text-xs text-muted-foreground">{m.description}</p>}</div>
                      {m.priceMinorUnits !== null && <span className="text-sm font-semibold text-foreground">{formatMoney(moneyFromMinor(m.priceMinorUnits, "INR"))}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">{m.dietaryTags.map((t) => <span key={t} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{t}</span>)}</div>
                    <div className="flex items-center justify-end">
                      {canManage ? (
                        <Button size="sm" variant="ghost" onClick={async () => { await updateCafeteriaItemRequest(m.id, { status: m.status === "active" ? "archived" : "active" }); reloadItems(); }}>{m.status === "active" ? "Active" : "Archived"}</Button>
                      ) : (
                        <Badge tone={m.status === "active" ? "success" : "neutral"}>{m.status === "active" ? "Available" : "Off menu"}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {items.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No menu items yet.</p>}
        </div>
      ) : !location ? (
        <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No cafeteria location configured yet. <a href="/cafeteria/counters" className="text-primary">Add one →</a></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-sm font-semibold">Meal</th>{dates.map((d) => <th key={d} className="p-sm font-semibold">{new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}</th>)}</tr></thead>
            <tbody>{MEAL_TYPES.map((mt) => (
              <tr key={mt} className="border-b border-border last:border-0">
                <td className="p-sm font-medium text-foreground">{MEAL_TYPE_LABEL[mt]}</td>
                {dates.map((d) => { const m = menuFor(d, mt); return (
                  <td key={d} className="p-sm text-xs">
                    <button onClick={() => setCell({ date: d, mealType: mt })} className="text-muted-foreground hover:text-primary">{m ? `${m.itemCount} item${m.itemCount === 1 ? "" : "s"}` : "—"}</button>
                  </td>
                ); })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <AddItemDrawer open={addingItem} onOpenChange={setAddingItem} onDone={() => { setAddingItem(false); reloadItems(); }} />
      {location && cell && (
        <MenuSlotDrawer
          locationId={location.id} date={cell.date} mealType={cell.mealType} existingMenuId={menuFor(cell.date, cell.mealType)?.id}
          onClose={() => setCell(null)} onChanged={reloadMenus}
        />
      )}
    </div>
  );
}

function AddItemDrawer({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");

  async function submit() {
    if (!code.trim() || !name.trim()) return;
    await createCafeteriaItemRequest({ code, name, category: category || undefined, priceMinorUnits: price ? Math.round(parseFloat(price) * 100) : undefined });
    setCode(""); setName(""); setCategory(""); setPrice("");
    onDone();
  }

  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="Add menu item" description="New cafeteria item">
      <div className="flex flex-col gap-md">
        <div className="flex flex-col gap-1.5"><Label htmlFor="code">Code *</Label><Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. IDLI-01" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="name">Name *</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Idli Sambar" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="cat">Category</Label><Input id="cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. breakfast" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="price">Price (₹, optional, informational only)</Label><Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="45" /></div>
        <div className="flex justify-end gap-xs"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit}>Save</Button></div>
      </div>
    </DetailDrawer>
  );
}

function MenuSlotDrawer({ locationId, date, mealType, existingMenuId, onClose, onChanged }: {
  locationId: string; date: string; mealType: CafeteriaMealTypeDto; existingMenuId: string | undefined; onClose: () => void; onChanged: () => void;
}) {
  const { hasServerPermission } = usePermissions();
  const canManage = hasServerPermission("cafeteria.manage");
  const canServe = hasServerPermission("cafeteria.serve");
  const { data: allItems } = useCafeteriaItems({ status: "active" });
  const { data: menuDetail, reload: reloadDetail } = useCafeteriaMenu(existingMenuId);
  const { data: served, reload: reloadServed } = useCafeteriaMeals(existingMenuId ? { menuId: existingMenuId } : {});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const { data: students } = useStudentList({ status: ["active"], pageSize: 300 });
  const { data: staff } = useStaffList({ status: "active", pageSize: 300 });
  const [consumerType, setConsumerType] = useState<"student" | "staff">("student");
  const [consumerId, setConsumerId] = useState("");
  const [serveItemId, setServeItemId] = useState("");

  const currentIds = menuDetail?.items.map((i) => i.cafeteriaItemId) ?? [];
  const effectiveIds = selectedIds.length ? selectedIds : currentIds;

  async function createMenu() {
    const res = await createCafeteriaMenuRequest({ locationId, date, mealType });
    if (res.success) onChanged();
  }
  async function saveItems() {
    if (!existingMenuId) return;
    await setCafeteriaMenuItemsRequest(existingMenuId, { itemIds: effectiveIds });
    reloadDetail();
    onChanged();
  }
  async function serve() {
    if (!existingMenuId || !consumerId) return;
    await recordCafeteriaMealRequest({ menuId: existingMenuId, [consumerType === "student" ? "studentId" : "staffId"]: consumerId, cafeteriaItemId: serveItemId || undefined });
    setConsumerId(""); setStudentQuery("");
    reloadServed();
  }

  const studentMatches = studentQuery.trim() ? students.filter((s) => s.fullName.toLowerCase().includes(studentQuery.trim().toLowerCase())).slice(0, 6) : [];

  return (
    <DetailDrawer open onOpenChange={(o) => !o && onClose()} title={`${MEAL_TYPE_LABEL[mealType]} · ${new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}`} description="Menu slot">
      <div className="flex flex-col gap-md">
        {!existingMenuId ? (
          <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border p-md text-center">
            <p className="text-sm text-muted-foreground">No menu published for this slot.</p>
            {canManage && <Button size="sm" onClick={createMenu}>Create menu</Button>}
          </div>
        ) : (
          <>
            {canManage && (
              <div>
                <h3 className="mb-sm text-sm font-semibold text-foreground">Items</h3>
                <div className="flex flex-col gap-1 rounded-md border border-border p-sm">
                  {allItems.map((it) => (
                    <label key={it.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={effectiveIds.includes(it.id)} onChange={(e) => {
                        const next = e.target.checked ? [...effectiveIds, it.id] : effectiveIds.filter((id) => id !== it.id);
                        setSelectedIds(next);
                      }} />
                      {it.name}
                    </label>
                  ))}
                </div>
                <Button size="sm" className="mt-2" onClick={saveItems}>Save items</Button>
              </div>
            )}
            {!canManage && menuDetail && (
              <div><h3 className="mb-sm text-sm font-semibold text-foreground">Items</h3><div className="flex flex-wrap gap-1">{menuDetail.items.map((i) => <span key={i.id} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs text-muted-foreground">{i.name}</span>)}</div></div>
            )}

            {canServe && (
              <div className="flex flex-col gap-2 rounded-md border border-border p-sm">
                <h3 className="text-sm font-semibold text-foreground">Record meal service</h3>
                <Select value={consumerType} onValueChange={(v) => { setConsumerType(v as "student" | "staff"); setConsumerId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="staff">Staff</SelectItem></SelectContent>
                </Select>
                {consumerType === "student" ? (
                  consumerId ? (
                    <div className="flex items-center justify-between rounded-md border border-border p-sm text-sm"><span>{students.find((s) => s.id === consumerId)?.fullName}</span><Button size="sm" variant="ghost" onClick={() => setConsumerId("")}>Change</Button></div>
                  ) : (
                    <>
                      <Input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Search student…" />
                      {studentMatches.map((s) => <button key={s.id} onClick={() => setConsumerId(s.id)} className="rounded-md border border-border p-sm text-left text-sm hover:border-primary/40">{s.fullName}</button>)}
                    </>
                  )
                ) : (
                  <Select value={consumerId} onValueChange={setConsumerId}>
                    <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {(menuDetail?.items.length ?? 0) > 0 && (
                  <Select value={serveItemId} onValueChange={setServeItemId}>
                    <SelectTrigger><SelectValue placeholder="Item (optional)" /></SelectTrigger>
                    <SelectContent>{menuDetail!.items.map((i) => <SelectItem key={i.cafeteriaItemId} value={i.cafeteriaItemId}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <Button size="sm" onClick={serve} disabled={!consumerId}>Record served</Button>
              </div>
            )}

            <div>
              <h3 className="mb-sm text-sm font-semibold text-foreground">Served ({served.length})</h3>
              {served.length === 0 ? <p className="text-sm text-muted-foreground">No one served yet.</p> : (
                <div className="flex flex-col gap-1">{served.map((s) => <p key={s.id} className="text-sm text-foreground">{s.consumerName} <span className="text-xs text-muted-foreground">({s.consumerType}){s.itemName ? ` · ${s.itemName}` : ""}</span></p>)}</div>
              )}
            </div>
          </>
        )}
      </div>
    </DetailDrawer>
  );
}
