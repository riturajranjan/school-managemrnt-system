"use client";

// Clubs (Phase 9U) — real Activity rows of type "club". facultyAdvisor is
// replaced by coordinatorNames (derived from real ActivityStaffAssignment ->
// Staff). meetingSchedule/foundedYear/venue had no real backing and are
// dropped rather than fabricated.
import Link from "next/link";
import { useState } from "react";
import { Plus, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createActivityRequest, useActivities } from "@/lib/hooks/api/use-activities-api";
import { roleLabels } from "@/lib/permissions/roles";

const statusTone = { active: "success", inactive: "warning", archived: "neutral" } as const;

export default function ClubsListPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: clubs, reload } = useActivities({ type: "club" });
  const [adding, setAdding] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("activities.view")) return <PermissionDenied action="view clubs" role={roleLabels[role]} backHref="/activities" />;
  const canManage = hasServerPermission("activities.manage");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Clubs & societies</h1><p className="text-xs text-muted-foreground">{clubs.length} clubs</p></div>
        {canManage && <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5" /> New club</Button>}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {clubs.map((c) => (
          <Link key={c.id} href={`/activities/clubs/${c.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
            <div className="flex items-start justify-between gap-sm">
              <div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Users2 className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{c.name}</p><p className="truncate text-xs text-muted-foreground">{c.coordinatorNames.length > 0 ? c.coordinatorNames.join(", ") : "No coordinator assigned"}</p></div></div>
              <Badge tone={statusTone[c.status]}>{c.status}</Badge>
            </div>
            {c.description && <p className="line-clamp-2 text-xs text-muted-foreground">{c.description}</p>}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{c.memberCount}{c.capacity ? `/${c.capacity}` : ""} members</span>
              <span>{c.code}</span>
            </div>
            {c.capacity && <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-secondary"><div className="h-full rounded-pill bg-primary" style={{ width: `${Math.min(100, Math.round((c.memberCount / c.capacity) * 100))}%` }} /></div>}
          </Link>
        ))}
        {clubs.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No clubs yet.</div>}
      </div>

      <AddClubDrawer open={adding} onOpenChange={setAdding} onDone={() => { setAdding(false); reload(); }} />
    </div>
  );
}

function AddClubDrawer({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const res = await createActivityRequest({ code, name, type: "club", description: description || undefined, capacity: capacity ? Number(capacity) : undefined });
    if (!res.success) { setError(res.error.message); return; }
    setCode(""); setName(""); setDescription(""); setCapacity(""); setError(null);
    onDone();
  }

  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="New club" description="Create a real club">
      <div className="flex flex-col gap-md">
        <div className="flex flex-col gap-1.5"><Label htmlFor="club-code">Code *</Label><Input id="club-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CLUB-DEBATE" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="club-name">Name *</Label><Input id="club-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Debate Club" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="club-desc">Description</Label><Textarea id="club-desc" value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} rows={2} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="club-cap">Capacity (optional)</Label><Input id="club-cap" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
        {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}
        <div className="flex justify-end gap-xs"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={!code.trim() || !name.trim()}>Create</Button></div>
      </div>
    </DetailDrawer>
  );
}
