"use client";

// Real Add-ons (Super Admin SA-4M). Shows the DB add-on catalog (status, pricing,
// assigned-school count) and — for a selected real school — assign/remove per
// add-on. No mock store, no fake activation: assignment is a real SchoolAddOn row
// (commercial terms snapshotted). Add-on invoicing is intentionally out of scope
// (entitlement only).
import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SchoolPicker } from "@/components/super-admin/school-picker";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  assignAddOnRequest,
  removeSchoolAddOnRequest,
  setAddOnStatusRequest,
  useAddOns,
  useSchoolAddOns,
} from "@/lib/hooks/api/use-platform-commerce";
import { formatMinor } from "@/lib/finance/format-minor";
import type { StatusTone } from "@/lib/types/common";

const statusTone: Record<string, StatusTone> = { active: "success", draft: "warning", archived: "neutral" };

export default function AddonsPage() {
  const { hasServerPermission } = usePermissions();
  const canManage = hasServerPermission("platform.addons.manage");
  const [schoolId, setSchoolId] = useState("");
  const catalog = useAddOns();
  const assignments = useSchoolAddOns(schoolId);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Map addOnId → active assignment for the selected school.
  const activeByAddOn = useMemo(() => {
    const m = new Map<string, { id: string }>();
    for (const a of assignments.data ?? []) if (a.status === "active") m.set(a.addOn.id, { id: a.id });
    return m;
  }, [assignments.data]);

  const refresh = () => { catalog.reload(); assignments.reload(); };

  async function assign(addOnId: string) {
    setBusy(addOnId); setActionError(null);
    const res = await assignAddOnRequest(schoolId, addOnId);
    setBusy(null);
    if (!res.success) setActionError(res.error.message); else refresh();
  }
  async function remove(addOnId: string, assignmentId: string) {
    setBusy(addOnId); setActionError(null);
    const res = await removeSchoolAddOnRequest(schoolId, assignmentId);
    setBusy(null);
    if (!res.success) setActionError(res.error.message); else refresh();
  }
  async function toggleArchive(id: string, archived: boolean) {
    setBusy(id); setActionError(null);
    const res = await setAddOnStatusRequest(id, archived ? "active" : "archived");
    setBusy(null);
    if (!res.success) setActionError(res.error.message); else refresh();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Package className="size-5 text-primary" /> Add-ons</h1>
          <p className="text-xs text-muted-foreground">Optional extensions assigned per school · entitlement only (no billing)</p>
        </div>
        <SchoolPicker value={schoolId} onChange={setSchoolId} />
      </div>

      {actionError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}
      {catalog.loading && <div className="py-2xl text-center text-sm text-muted-foreground">Loading add-ons…</div>}
      {catalog.error && !catalog.loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load add-ons: {catalog.error}</div>}

      {!catalog.loading && !catalog.error && (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
          {catalog.data.map((a) => {
            const assignment = activeByAddOn.get(a.id);
            const assigned = Boolean(assignment);
            const archived = a.status === "archived";
            return (
              <div key={a.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
                <div className="flex items-start justify-between gap-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{a.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.category ?? "—"} · {a.assignedSchoolCount} school{a.assignedSchoolCount === 1 ? "" : "s"}</p>
                  </div>
                  <Badge tone={statusTone[a.status] ?? "neutral"}>{a.status}</Badge>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{a.description ?? ""}</p>
                <p className="text-sm font-bold text-foreground">{a.priceAmount != null ? formatMinor(a.priceAmount * 100) : "—"}<span className="text-xs font-normal text-muted-foreground">{a.billingInterval ? ` / ${a.billingInterval === "yearly" ? "yr" : "mo"}` : ""}</span></p>
                <div className="mt-auto flex items-center gap-2">
                  {canManage && !archived && (assigned ? (
                    <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => void remove(a.id, assignment!.id)}>Remove</Button>
                  ) : (
                    <Button size="sm" disabled={busy === a.id} onClick={() => void assign(a.id)}>Assign to school</Button>
                  ))}
                  {assigned && <Badge tone="info">Assigned</Badge>}
                  {canManage && (
                    <Button size="sm" variant="ghost" className={archived ? "" : "text-error"} disabled={busy === a.id} onClick={() => void toggleArchive(a.id, archived)}>{archived ? "Reactivate" : "Archive"}</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
