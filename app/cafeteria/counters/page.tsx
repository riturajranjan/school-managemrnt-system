"use client";

// Cafeteria locations (Phase 9T) — real PostgreSQL/API cutover. The old
// mock's "counters" (with a `queueMock` field literally named mock) are
// replaced by the real CafeteriaLocation master; live queue length was
// never a real concept and is dropped, not preserved as fake data.
import { useState } from "react";
import { Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createCafeteriaLocationRequest, useCafeteriaLocations } from "@/lib/hooks/api/use-cafeteria-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function CountersPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: locations, reload } = useCafeteriaLocations();
  const [adding, setAdding] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("cafeteria.view")) return <PermissionDenied action="view locations" role={roleLabels[role]} backHref="/cafeteria" />;
  const canManage = hasServerPermission("cafeteria.manage");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Locations</h1><p className="text-xs text-muted-foreground">{locations.filter((l) => l.status === "active").length} active</p></div>
        {canManage && <Button size="sm" onClick={() => setAdding(true)}>Add location</Button>}
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((l) => (
          <div key={l.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-start justify-between gap-sm"><div className="flex items-center gap-sm"><span className={`flex size-9 items-center justify-center rounded-md ${l.status === "active" ? "bg-success/10 text-success" : "bg-surface-secondary text-muted-foreground"}`}><Store className="size-4" /></span><p className="text-sm font-semibold text-foreground">{l.name}</p></div><Badge tone={l.status === "active" ? "success" : "neutral"}>{l.status}</Badge></div>
            {l.description && <p className="text-xs text-muted-foreground">{l.description}</p>}
          </div>
        ))}
        {locations.length === 0 && <p className="col-span-full rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No locations yet.</p>}
      </div>

      <AddLocationDrawer open={adding} onOpenChange={setAdding} onDone={() => { setAdding(false); reload(); }} />
    </div>
  );
}

function AddLocationDrawer({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function submit() {
    if (!code.trim() || !name.trim()) return;
    await createCafeteriaLocationRequest({ code, name, description: description || undefined });
    setCode(""); setName(""); setDescription("");
    onDone();
  }

  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="Add location" description="New cafeteria serving location">
      <div className="flex flex-col gap-md">
        <div className="flex flex-col gap-1.5"><Label htmlFor="lcode">Code *</Label><Input id="lcode" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. MAIN" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="lname">Name *</Label><Input id="lname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Counter" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="ldesc">Description</Label><Input id="ldesc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="flex justify-end gap-xs"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit}>Save</Button></div>
      </div>
    </DetailDrawer>
  );
}
