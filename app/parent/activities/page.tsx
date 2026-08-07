"use client";

import { useMemo } from "react";
import { Award, CalendarDays, Medal, Sparkles, Trophy, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { studentParticipation } from "@/lib/selectors/activities-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { achievementLevelLabels, achievementLevelTone, clubMemberRoleLabels, eventCategoryLabels } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function ParentActivitiesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();

  const child = db.students[0];
  const part = useMemo(() => (child ? studentParticipation(db, child.id) : null), [db, child]);
  const myClubs = useMemo(() => (child ? db.clubMemberships.filter((m) => m.studentId === child.id) : []), [db.clubMemberships, child]);
  const myTeams = useMemo(() => (child ? db.teamMembers.filter((m) => m.studentId === child.id) : []), [db.teamMembers, child]);
  const myAchievements = useMemo(() => (child ? db.achievements.filter((a) => a.studentId === child.id) : []), [db.achievements, child]);
  const attended = useMemo(() => (child ? db.eventAttendance.filter((a) => a.studentId === child.id && a.present) : []), [db.eventAttendance, child]);
  const house = child ? db.houses.find((h) => h.name === child.profile.house) : undefined;

  if (!can("activities.viewOwn") && !can("activities.view")) return <PermissionDenied action="view your child's activities" role={roleLabels[role]} backHref="/" />;
  if (!child || !part) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No student profile found.</div>;

  const clubName = (id: string) => db.clubs.find((c) => c.id === id)?.name ?? id;
  const teamName = (id: string) => db.sportsTeams.find((t) => t.id === id)?.name ?? id;
  const eventTitle = (id: string) => db.schoolEvents.find((e) => e.id === id)?.title ?? id;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Sparkles className="size-4" /></span>
        <div><h1 className="text-lg font-semibold text-foreground">Activities — {child.profile.firstName}</h1><p className="text-xs text-muted-foreground">{house ? `${house.emblem} ${house.name} House` : "Involvement overview"}</p></div>
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
          <h2 className="mb-sm text-sm font-semibold text-foreground">Clubs & teams</h2>
          <div className="flex flex-wrap gap-1">
            {myClubs.map((m) => <span key={m.id} className="rounded-pill bg-surface-secondary px-2.5 py-1 text-xs text-foreground">{clubName(m.clubId)} · {clubMemberRoleLabels[m.role]}</span>)}
            {myTeams.map((m) => <span key={m.id} className="rounded-pill bg-primary/10 px-2.5 py-1 text-xs text-primary">{teamName(m.teamId)}</span>)}
            {myClubs.length === 0 && myTeams.length === 0 && <p className="text-sm text-muted-foreground">Not part of any club or team yet.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Recent events attended</h2>
          <div className="flex flex-col gap-xs">
            {attended.slice(0, 6).map((a) => <div key={a.id} className="rounded-md border border-border p-sm text-sm text-foreground">{eventTitle(a.eventId)}{a.checkInTime && <span className="ml-1 text-xs text-muted-foreground">· {a.checkInTime}</span>}</div>)}
            {attended.length === 0 && <p className="text-sm text-muted-foreground">No event attendance recorded.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md lg:col-span-2">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Achievements</h2>
          <div className="flex flex-col gap-xs">
            {myAchievements.map((a) => <div key={a.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm"><div className="min-w-0"><p className="truncate text-foreground">{a.title}</p><p className="text-xs text-muted-foreground">{eventCategoryLabels[a.category]} · {formatDate(a.date)}</p></div><Badge tone={achievementLevelTone[a.level]}>{achievementLevelLabels[a.level]}</Badge></div>)}
            {myAchievements.length === 0 && <p className="text-sm text-muted-foreground">No achievements recorded yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
