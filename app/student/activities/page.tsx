"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Award, CalendarDays, Medal, Sparkles, Trophy, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { studentParticipation } from "@/lib/selectors/activities-brief";
import { registerForEvent } from "@/lib/services/activities-service";
import { roleLabels } from "@/lib/permissions/roles";
import { achievementLevelLabels, achievementLevelTone, clubMemberRoleLabels, eventCategoryLabels } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function StudentActivitiesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const child = db.students[0];
  const part = useMemo(() => (child ? studentParticipation(db, child.id) : null), [db, child]);
  const myClubs = useMemo(() => (child ? db.clubMemberships.filter((m) => m.studentId === child.id) : []), [db.clubMemberships, child]);
  const myTeams = useMemo(() => (child ? db.teamMembers.filter((m) => m.studentId === child.id) : []), [db.teamMembers, child]);
  const myAchievements = useMemo(() => (child ? db.achievements.filter((a) => a.studentId === child.id) : []), [db.achievements, child]);
  const myCerts = useMemo(() => (child ? db.certificates.filter((c) => c.studentId === child.id) : []), [db.certificates, child]);
  const house = child ? db.houses.find((h) => h.name === child.profile.house) : undefined;
  const openEvents = useMemo(() => db.schoolEvents.filter((e) => (e.stage === "promotion" || e.stage === "approved") && e.registrationMode !== "none").slice(0, 5), [db.schoolEvents]);

  if (!can("activities.viewOwn") && !can("activities.view")) return <PermissionDenied action="view your activities" role={roleLabels[role]} backHref="/" />;
  if (!child || !part) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No student profile found.</div>;

  const clubName = (id: string) => db.clubs.find((c) => c.id === id)?.name ?? id;
  const teamName = (id: string) => db.sportsTeams.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Sparkles className="size-4" /></span>
        <div><h1 className="text-lg font-semibold text-foreground">My activities — {child.profile.firstName}</h1><p className="text-xs text-muted-foreground">{house ? `${house.emblem} ${house.name} House` : "Activity portfolio"}</p></div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-5">
        <StatTile label="Events attended" value={String(part.eventsAttended)} icon={CalendarDays} tone="info" />
        <StatTile label="Clubs" value={String(part.clubsJoined)} icon={Users2} tone="neutral" />
        <StatTile label="Teams" value={String(part.sportsTeams)} icon={Trophy} tone="info" />
        <StatTile label="Competitions" value={String(part.competitionsEntered)} icon={Medal} tone="warning" />
        <StatTile label="Achievements" value={String(part.achievements)} icon={Award} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">My clubs & teams</h2>
          <div className="flex flex-wrap gap-1">
            {myClubs.map((m) => <span key={m.id} className="rounded-pill bg-surface-secondary px-2.5 py-1 text-xs text-foreground">{clubName(m.clubId)} · {clubMemberRoleLabels[m.role]}</span>)}
            {myTeams.map((m) => <span key={m.id} className="rounded-pill bg-primary/10 px-2.5 py-1 text-xs text-primary">{teamName(m.teamId)}</span>)}
            {myClubs.length === 0 && myTeams.length === 0 && <p className="text-sm text-muted-foreground">Not part of any club or team yet.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Open for registration</h2><Link href="/activities/events/calendar" className="text-xs text-primary">Calendar →</Link></div>
          {msg && <p className="mb-sm rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">{msg}</p>}
          <div className="flex flex-col gap-xs">
            {openEvents.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <div className="min-w-0"><p className="truncate text-foreground">{e.title}</p><p className="truncate text-xs text-muted-foreground">{eventCategoryLabels[e.category]} · {formatDate(e.startDate)}</p></div>
                <Button size="sm" variant="outline" onClick={() => { const r = registerForEvent(e.id, child.id); setMsg(r.ok ? `Registered for ${e.title} (${r.status}).` : r.error); force((n) => n + 1); }}>Register</Button>
              </div>
            ))}
            {openEvents.length === 0 && <p className="text-sm text-muted-foreground">No events open right now.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Achievements</h2>
          <div className="flex flex-col gap-xs">
            {myAchievements.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm"><div className="min-w-0"><p className="truncate text-foreground">{a.title}</p><p className="text-xs text-muted-foreground">{formatDate(a.date)}</p></div><Badge tone={achievementLevelTone[a.level]}>{achievementLevelLabels[a.level]}</Badge></div>
            ))}
            {myAchievements.length === 0 && <p className="text-sm text-muted-foreground">No achievements recorded yet.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">My certificates</h2>
          <div className="flex flex-col gap-xs">
            {myCerts.map((c) => <div key={c.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm"><span className="min-w-0 truncate text-foreground">{c.eventTitle}</span><span className="text-xs text-muted-foreground">{formatDate(c.issuedDate)}</span></div>)}
            {myCerts.length === 0 && <p className="text-sm text-muted-foreground">No certificates yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
