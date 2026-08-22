"use client";

// Activity detail (Phase 9U) — real Activity + ActivityStaffAssignment +
// ActivityStudentMembership + ActivityEvent. The mock's "meetings" section
// had no real backing (no ClubMeeting model in this phase) and is dropped
// entirely rather than shown fake.
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, CalendarDays, Plus, UserCog, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import {
  assignActivityStaffRequest,
  endActivityStaffRequest,
  joinActivityRequest,
  leaveActivityRequest,
  useActivity,
  useActivityEvents,
  useActivityMembers,
  useActivityStaff,
} from "@/lib/hooks/api/use-activities-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { ActivityStaffRoleDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const eventStatusTone = { draft: "neutral", published: "info", completed: "success", cancelled: "error" } as const;

export default function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: activity, loading, reload } = useActivity(id);
  const { data: staff, reload: reloadStaff } = useActivityStaff(id);
  const { data: members, reload: reloadMembers } = useActivityMembers(id, { status: "active" });
  const { data: events } = useActivityEvents({ activityId: id });
  const [error, setError] = useState<string | null>(null);
  const [addingStaff, setAddingStaff] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("activities.view")) return <PermissionDenied action="view this activity" role={roleLabels[role]} backHref="/activities/clubs" />;
  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (!activity) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Activity not found. <Link href="/activities/clubs" className="text-primary">Back</Link></div>;

  const canManage = hasServerPermission("activities.manage");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/clubs"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold text-foreground">{activity.name}</h1><Badge tone="neutral">{activity.code}</Badge></div><p className="text-xs text-muted-foreground">{activity.description ?? "No description"}</p></div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Members" value={activity.capacity ? `${activity.memberCount}/${activity.capacity}` : String(activity.memberCount)} icon={Users2} tone="info" />
        <StatTile label="Coordinators" value={String(staff.filter((s) => s.status === "active").length)} icon={UserCog} tone="neutral" />
        <StatTile label="Events" value={String(events.length)} icon={CalendarDays} tone="neutral" />
        <StatTile label="Status" value={activity.status} tone={activity.status === "active" ? "success" : "neutral"} />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><UserCog className="size-4" /> Coordinators</h2>{canManage && <Button size="sm" variant="outline" onClick={() => setAddingStaff(true)}><Plus className="size-3.5" /> Assign</Button>}</div>
          <div className="flex flex-col gap-xs">
            {staff.filter((s) => s.status === "active").map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <div className="min-w-0"><p className="truncate text-foreground">{s.staffName}</p><p className="text-xs capitalize text-muted-foreground">{s.role}</p></div>
                {canManage && <Button size="sm" variant="ghost" onClick={async () => { await endActivityStaffRequest(id, s.id); reloadStaff(); }}>End</Button>}
              </div>
            ))}
            {staff.filter((s) => s.status === "active").length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No coordinators assigned.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><Users2 className="size-4" /> Members</h2>{canManage && <Button size="sm" variant="outline" onClick={() => setAddingMember(true)}><Plus className="size-3.5" /> Add</Button>}</div>
          {error && <p className="mb-sm text-xs text-error">{error}</p>}
          <div className="flex flex-col gap-xs">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <div className="min-w-0"><p className="truncate text-foreground">{m.studentName}</p><p className="text-xs text-muted-foreground">{m.admissionNumber} · since {formatDate(m.joinedAt)}</p></div>
                {canManage && <Button size="sm" variant="ghost" onClick={async () => { const r = await leaveActivityRequest(id, m.id); if (!r.success) setError(r.error.message); reloadMembers(); }}>Remove</Button>}
              </div>
            ))}
            {members.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No active members.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md lg:col-span-2">
          <div className="mb-sm flex items-center justify-between"><h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><CalendarDays className="size-4" /> Events</h2><Link href="/activities/events/new" className="text-xs text-primary">New event →</Link></div>
          <div className="flex flex-col gap-xs">
            {events.map((e) => (
              <Link key={e.id} href={`/activities/events/${e.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm hover:border-primary/40">
                <div className="min-w-0"><p className="truncate text-foreground">{e.title}</p><p className="text-xs text-muted-foreground">{formatDate(e.startAt)}{e.location ? ` · ${e.location}` : ""}</p></div>
                <Badge tone={eventStatusTone[e.status]}>{e.status}</Badge>
              </Link>
            ))}
            {events.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No events scheduled.</p>}
          </div>
        </div>
      </div>

      {addingStaff && <AssignStaffDrawer activityId={id} onClose={() => setAddingStaff(false)} onDone={() => { setAddingStaff(false); reloadStaff(); }} />}
      {addingMember && <AddMemberDrawer activityId={id} onClose={() => setAddingMember(false)} onDone={() => { setAddingMember(false); reloadMembers(); reload(); }} />}
    </div>
  );
}

function AssignStaffDrawer({ activityId, onClose, onDone }: { activityId: string; onClose: () => void; onDone: () => void }) {
  const { data: staffList } = useStaffList({ status: "active", pageSize: 300 });
  const [staffId, setStaffId] = useState("");
  const [role, setRole] = useState<ActivityStaffRoleDto>("coordinator");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!staffId) return;
    const res = await assignActivityStaffRequest(activityId, { staffId, role });
    if (!res.success) { setError(res.error.message); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-md" role="dialog">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Assign coordinator/coach</h2>
        <div className="flex flex-col gap-sm">
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
            <SelectContent>{staffList.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={role} onValueChange={(v) => setRole(v as ActivityStaffRoleDto)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="coordinator">Coordinator</SelectItem><SelectItem value="coach">Coach</SelectItem><SelectItem value="mentor">Mentor</SelectItem></SelectContent>
          </Select>
          {error && <p className="text-xs text-error">{error}</p>}
          <div className="flex justify-end gap-xs"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={!staffId}>Assign</Button></div>
        </div>
      </div>
    </div>
  );
}

function AddMemberDrawer({ activityId, onClose, onDone }: { activityId: string; onClose: () => void; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const { data: students } = useStudentList({ status: ["active"], pageSize: 300 });
  const [error, setError] = useState<string | null>(null);
  const matches = query.trim() ? students.filter((s) => s.fullName.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];

  async function add(studentId: string) {
    const res = await joinActivityRequest(activityId, { studentId });
    if (!res.success) { setError(res.error.message); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-md" role="dialog">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Add member</h2>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student…" className="mb-sm w-full rounded-md border border-border bg-surface px-sm py-1.5 text-sm text-foreground outline-none focus:border-primary" />
        {error && <p className="mb-sm text-xs text-error">{error}</p>}
        <div className="flex flex-col gap-1">
          {matches.map((s) => <button key={s.id} onClick={() => add(s.id)} className="rounded-md border border-border p-sm text-left text-sm hover:border-primary/40">{s.fullName}</button>)}
        </div>
        <div className="mt-sm flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}
