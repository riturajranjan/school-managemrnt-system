"use client";

// Hostels (Phase 9Q) — real PostgreSQL/API cutover. Mock "buildings" ARE the
// top-level Hostel entity (no separate Block/Floor model — see the schema's
// doc comment). Occupancy is always derived, never a fabricated counter.
// Warden is a real Staff.id, never a free-text name.
import Link from "next/link";
import { useState } from "react";
import { Building2, Plus, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createHostelRequest, useHostelRooms, useHostels, useHostelStaffAssignments, assignHostelStaffRequest } from "@/lib/hooks/api/use-hostel-api";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { HostelMasterStatusDto } from "@/lib/api/contracts";

const statusTone: Record<HostelMasterStatusDto, "success" | "warning" | "neutral"> = { active: "success", maintenance: "warning", archived: "neutral" };

export default function HostelBuildingsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: hostels, reload } = useHostels();
  const { data: rooms } = useHostelRooms();
  const { data: wardenAssignments } = useHostelStaffAssignments({ status: "active" });
  const { data: staff } = useStaffList({ status: "active", pageSize: 500 });
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [genderPolicy, setGenderPolicy] = useState<string>("__none__");
  const [error, setError] = useState<string | null>(null);
  const [wardenPickerFor, setWardenPickerFor] = useState<string | null>(null);
  const [wardenStaffId, setWardenStaffId] = useState("");

  if (!capabilitiesLoading && !hasServerPermission("hostel.view")) return <PermissionDenied action="view hostels" role={roleLabels[role]} backHref="/hostel" />;
  const canManage = hasServerPermission("hostel.manage");

  async function submit() {
    setError(null);
    if (!code.trim() || !name.trim()) return setError("Code and name are required.");
    const res = await createHostelRequest({ code: code.trim(), name: name.trim(), genderPolicy: genderPolicy === "__none__" ? undefined : (genderPolicy as "boys" | "girls" | "mixed") });
    if (!res.success) return setError(res.error.message);
    setCode(""); setName(""); setGenderPolicy("__none__"); setCreateOpen(false);
    reload();
  }

  async function assignWarden() {
    if (!wardenPickerFor || !wardenStaffId) return;
    await assignHostelStaffRequest({ hostelId: wardenPickerFor, staffId: wardenStaffId, role: "warden" });
    setWardenPickerFor(null); setWardenStaffId("");
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Hostels</h1>
          <p className="text-xs text-muted-foreground">{hostels.length} hostels</p>
        </div>
        {canManage && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> Add hostel</Button>}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {hostels.map((h) => {
          const hostelRooms = rooms.filter((r) => r.hostelId === h.id);
          const totalBeds = hostelRooms.reduce((s, r) => s + r.activeBeds, 0);
          const occupied = hostelRooms.reduce((s, r) => s + r.occupiedBeds, 0);
          const pct = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;
          const warden = wardenAssignments.find((w) => w.hostelId === h.id && w.role === "warden");
          return (
            <div key={h.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm">
                <div className="flex items-center gap-sm">
                  <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Building2 className="size-4" /></span>
                  <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{h.name}</p><p className="text-xs text-muted-foreground">{h.code}{h.genderPolicy ? ` · ${h.genderPolicy}` : ""}</p></div>
                </div>
                <Badge tone={statusTone[h.status]}>{h.status}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-sm text-center text-xs">
                <div className="rounded-md border border-border p-sm"><p className="text-muted-foreground">Rooms</p><p className="text-sm font-semibold text-foreground">{hostelRooms.length}</p></div>
                <div className="rounded-md border border-border p-sm"><p className="text-muted-foreground">Beds</p><p className="text-sm font-semibold text-foreground">{totalBeds}</p></div>
                <div className="rounded-md border border-border p-sm"><p className="text-muted-foreground">Occupancy</p><p className="text-sm font-semibold text-foreground">{pct}%</p></div>
              </div>
              <div className="flex items-center justify-between gap-xs">
                <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"><UserCog className="size-3 shrink-0" /> Warden: {warden?.staffName ?? "Unassigned"}</p>
                {canManage && <Button size="sm" variant="ghost" onClick={() => setWardenPickerFor(h.id)}>{warden ? "Change" : "Assign"}</Button>}
              </div>
              <Link href={`/hostel/rooms?hostelId=${h.id}`} className="text-xs font-medium text-primary">View rooms →</Link>
            </div>
          );
        })}
      </div>

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add hostel" description="Create a real hostel">
        <div className="flex flex-col gap-md">
          <div><Label htmlFor="hostel-code">Code</Label><Input id="hostel-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. BH1" /></div>
          <div><Label htmlFor="hostel-name">Name</Label><Input id="hostel-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Boys Hostel 1" /></div>
          <div>
            <Label htmlFor="hostel-gender">Gender policy (optional)</Label>
            <Select value={genderPolicy} onValueChange={setGenderPolicy}>
              <SelectTrigger id="hostel-gender"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none__">Not set</SelectItem><SelectItem value="boys">Boys</SelectItem><SelectItem value="girls">Girls</SelectItem><SelectItem value="mixed">Mixed</SelectItem></SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button onClick={submit}>Create hostel</Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={wardenPickerFor !== null} onOpenChange={(o) => !o && setWardenPickerFor(null)} title="Assign warden" description="Real, active staff member">
        <div className="flex flex-col gap-md">
          <Select value={wardenStaffId} onValueChange={setWardenStaffId}>
            <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
            <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={assignWarden} disabled={!wardenStaffId}>Assign</Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
