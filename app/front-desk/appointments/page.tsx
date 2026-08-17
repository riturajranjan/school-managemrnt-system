"use client";

// Real PostgreSQL/API cutover (Phase 9I). "Appointments" is the same real
// VisitorVisit model with status=EXPECTED — no parallel Appointment domain
// (the old mock's richer AppointmentType taxonomy is dropped: it was never
// backed by a real write UI, only a display label, so purpose free-text now
// carries that context instead). The old mock page was read-only with no
// create action anywhere, which would leave the real EXPECTED state
// unreachable from the UI — a minimal "Schedule" form is added here (same
// visual language as the walk-in check-in drawer) so the feature is
// actually usable, not a redesign of the page's look.
import { useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStaff } from "@/lib/hooks/api/use-staff";
import { createExpectedVisitRequest, useVisits } from "@/lib/hooks/api/use-visitors-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { VisitorCategoryDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const categoryOptions: { value: VisitorCategoryDto; label: string }[] = [
  { value: "parent", label: "Parent" }, { value: "vendor", label: "Vendor" }, { value: "guest", label: "Guest" },
  { value: "contractor", label: "Contractor" }, { value: "interview_candidate", label: "Interview candidate" },
  { value: "alumni", label: "Alumni" }, { value: "official", label: "Official" }, { value: "other", label: "Other" },
];

export default function AppointmentsPage() {
  const { can, role } = usePermissions();
  const [tab, setTab] = useState<"today" | "upcoming" | "all">("today");
  const today = new Date().toISOString().slice(0, 10);

  const { data: rows, reload } = useVisits({ status: "expected", date: tab === "today" ? today : undefined });
  const { data: staff } = useStaff({ status: "active" });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<VisitorCategoryDto>("parent");
  const [purpose, setPurpose] = useState("");
  const [hostStaffId, setHostStaffId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!can("visitors.view")) return <PermissionDenied action="view appointments" role={roleLabels[role]} backHref="/front-desk" />;
  const canManage = can("visitors.manage");

  const filtered = [...rows]
    .filter((a) => (tab === "upcoming" ? !a.expectedAt || a.expectedAt >= new Date().toISOString() : true))
    .sort((a, b) => (a.expectedAt ?? "").localeCompare(b.expectedAt ?? ""));

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Visitor name is required.");
    if (!hostStaffId) return setError("Select a host to meet.");
    if (!expectedAt) return setError("Select the expected date & time.");
    setBusy(true);
    const result = await createExpectedVisitRequest({ fullName: name.trim(), phone: phone.trim(), category, purpose: purpose.trim() || "Visit", hostStaffId, expectedAt: new Date(expectedAt).toISOString() });
    setBusy(false);
    if (!result.success) return setError(result.error.message);
    setCreateOpen(false);
    setName(""); setPhone(""); setPurpose(""); setHostStaffId(""); setExpectedAt("");
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Appointments</h1>
          <p className="text-xs text-muted-foreground">Expected visitors</p>
        </div>
        <div className="flex items-center gap-sm">
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(["today", "upcoming", "all"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded px-sm py-1.5 text-xs font-medium capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
            ))}
          </div>
          {canManage && <Button size="sm" onClick={() => { setError(null); setCreateOpen(true); }}><Plus className="size-3.5" /> Schedule</Button>}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <CalendarClock className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No appointments in this view.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {filtered.map((a) => {
            const dt = a.expectedAt ? new Date(a.expectedAt) : null;
            return (
              <div key={a.id} className="flex items-center gap-sm rounded-lg border border-border bg-surface p-sm">
                <div className="flex w-16 shrink-0 flex-col items-center rounded-md bg-primary/10 py-1 text-primary">
                  <span className="text-xs font-bold">{dt ? dt.toTimeString().slice(0, 5) : "—"}</span>
                  <span className="text-[10px]">{dt ? formatDate(dt.toISOString(), { day: "2-digit", month: "short" }) : ""}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{a.visitorName}</p>
                  <p className="truncate text-xs text-muted-foreground">Host {a.hostName} · {a.purpose}{a.department ? ` · ${a.department}` : ""}</p>
                </div>
                <Badge tone="info">Expected</Badge>
              </div>
            );
          })}
        </div>
      )}

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Schedule an expected visitor" description="Creates a real visit record — check-in later updates the same record">
        <div className="flex flex-col gap-sm">
          {error && <p className="text-xs text-error">{error}</p>}
          <div>
            <Label htmlFor="ap-name">Visitor name *</Label>
            <Input id="ap-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ap-phone">Phone</Label>
            <Input id="ap-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
          </div>
          <div>
            <Label>Visitor type</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as VisitorCategoryDto)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ap-purpose">Purpose</Label>
            <Input id="ap-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Parent-teacher meeting" />
          </div>
          <div>
            <Label>Host to meet *</Label>
            <Select value={hostStaffId} onValueChange={setHostStaffId}>
              <SelectTrigger><SelectValue placeholder="Select host" /></SelectTrigger>
              <SelectContent>
                {staff?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ap-when">Expected date & time *</Label>
            <Input id="ap-when" type="datetime-local" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
          </div>
          <Button disabled={busy} onClick={submit}>Schedule</Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
