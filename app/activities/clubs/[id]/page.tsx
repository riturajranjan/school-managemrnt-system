"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, MapPin, Plus, UserCog, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { joinClub, setMembershipStatus } from "@/lib/services/activities-service";
import { roleLabels } from "@/lib/permissions/roles";
import { clubCategoryLabels, clubMemberRoleLabels } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

const meetingTone = { scheduled: "info", completed: "success", cancelled: "error" } as const;
const memberTone = { active: "success", pending: "warning", alumni: "neutral" } as const;

export default function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const club = db.clubs.find((c) => c.id === id);
  const members = useMemo(() => [...db.clubMemberships.filter((m) => m.clubId === id)].sort((a, b) => (a.role === "president" ? -1 : b.role === "president" ? 1 : 0)), [db.clubMemberships, id]);
  const meetings = useMemo(() => [...db.clubMeetings.filter((m) => m.clubId === id)].sort((a, b) => b.date.localeCompare(a.date)), [db.clubMeetings, id]);
  const studentName = (sid: string) => { const s = db.students.find((x) => x.id === sid); return s ? `${s.profile.firstName} ${s.profile.lastName}` : sid; };
  const nonMembers = useMemo(() => db.students.filter((s) => !members.some((m) => m.studentId === s.id && m.status !== "alumni")).slice(0, 8), [db.students, members]);

  if (!can("activities.view")) return <PermissionDenied action="view this club" role={roleLabels[role]} backHref="/activities/clubs" />;
  if (!club) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Club not found. <Link href="/activities/clubs" className="text-primary">Back</Link></div>;

  const canManage = can("activities.manageClubs");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/clubs"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold text-foreground">{club.name}</h1><Badge tone="neutral">{clubCategoryLabels[club.category]}</Badge></div><p className="text-xs text-muted-foreground">Founded {club.foundedYear} · Advisor {club.facultyAdvisor}</p></div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Members" value={`${club.memberCount}/${club.capacity}`} icon={Users2} tone="info" />
        <StatTile label="Meetings" value={String(meetings.length)} icon={CalendarDays} tone="neutral" />
        <StatTile label="Schedule" value={club.meetingSchedule} tone="neutral" />
        <StatTile label="Venue" value={club.venue} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><UserCog className="size-4" /> Members</h2></div>
          {canManage && (
            <div className="mb-sm">
              {error && <p className="mb-1 text-xs text-error">{error}</p>}
              <div className="flex flex-wrap gap-1">{nonMembers.slice(0, 5).map((s) => <Button key={s.id} size="sm" variant="outline" onClick={() => { const r = joinClub(id, s.id); if (!r.ok) setError(r.error); else setError(null); force((n) => n + 1); }}><Plus className="size-3.5" /> {s.profile.firstName}</Button>)}</div>
            </div>
          )}
          <div className="flex flex-col gap-xs">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <div className="min-w-0"><p className="truncate text-foreground">{studentName(m.studentId)}</p><p className="text-xs text-muted-foreground">{clubMemberRoleLabels[m.role]}</p></div>
                {canManage && m.status === "pending" ? (
                  <Button size="sm" variant="outline" onClick={() => { setMembershipStatus(m.id, "active"); force((n) => n + 1); }}>Approve</Button>
                ) : <Badge tone={memberTone[m.status]}>{m.status}</Badge>}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><CalendarDays className="size-4" /> Meetings</h2>
          <div className="flex flex-col gap-xs">
            {meetings.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <div className="min-w-0"><p className="truncate text-foreground">{m.agenda}</p><p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3" /> {m.venue} · {formatDate(m.date)} {m.time}</p></div>
                <Badge tone={meetingTone[m.status]}>{m.status}</Badge>
              </div>
            ))}
            {meetings.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No meetings scheduled.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
