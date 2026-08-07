"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { ArrowLeft, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { teamAgeGroupLabels } from "@/lib/types/activities";

const roleTone = {
  captain: "success",
  "vice-captain": "info",
  player: "neutral",
  reserve: "warning",
} as const;

export default function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();

  const team = db.sportsTeams.find((t) => t.id === id);
  const members = useMemo(
    () => db.teamMembers.filter((m) => m.teamId === id),
    [db.teamMembers, id],
  );
  const sport = team ? db.sports.find((s) => s.id === team.sportId) : undefined;
  const house = team?.houseId
    ? db.houses.find((h) => h.id === team.houseId)
    : undefined;
  const studentName = (sid: string) => {
    const s = db.students.find((x) => x.id === sid);
    return s ? `${s.profile.firstName} ${s.profile.lastName}` : sid;
  };

  if (!can("activities.view"))
    return (
      <PermissionDenied
        action="view this team"
        role={roleLabels[role]}
        backHref="/activities/sports"
      />
    );
  if (!team)
    return (
      <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
        Team not found.{" "}
        <Link href="/activities/sports" className="text-primary">
          Back
        </Link>
      </div>
    );

  // Team formation visual — group the starting XI (non-reserves) into rows by
  // position line for a pitch-style layout. Purely a mock arrangement.
  const starters = members.filter((m) => m.status !== "reserve").slice(0, 11);
  const reserves = members.filter(
    (m) => m.status === "reserve" || !starters.includes(m),
  );
  const lines: Record<string, typeof starters> = {
    Forward: [],
    Midfield: [],
    Defence: [],
    Goalkeeper: [],
  };
  starters.forEach((m) => {
    const line =
      m.position === "Goalkeeper"
        ? "Goalkeeper"
        : m.position === "Defence"
          ? "Defence"
          : m.position === "Forward" || m.position === "Opener"
            ? "Forward"
            : "Midfield";
    lines[line].push(m);
  });

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link
            href={
              sport ? `/activities/sports/${sport.id}` : "/activities/sports"
            }>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-foreground">
              {team.name}
            </h1>
            {house && (
              <Badge tone="info">
                <Shield className="size-3" /> {house.name}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {sport?.name} · {teamAgeGroupLabels[team.ageGroup]} · Coach{" "}
            {team.coachName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-sm">
        <StatTile label="Won" value={String(team.wins)} tone="success" />
        <StatTile label="Lost" value={String(team.losses)} tone="error" />
        <StatTile label="Drawn" value={String(team.draws)} tone="neutral" />
      </div>

      {/* Team formation visual */}
      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">
          Team formation
        </h2>
        <div className="mx-auto flex  flex-col gap-4 rounded-xl border border-emerald-600/30 bg-linear-to-b from-emerald-700/20 to-emerald-900/20 p-4">
          {(["Forward", "Midfield", "Defence", "Goalkeeper"] as const).map(
            (line) =>
              lines[line].length > 0 && (
                <div
                  key={line}
                  className="flex flex-wrap items-center justify-center gap-3">
                  {lines[line].map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col items-center gap-1">
                      <span
                        className="flex size-9 items-center justify-center rounded-full bg-white text-xs font-bold text-emerald-900 shadow"
                        title={studentName(m.studentId)}>
                        {m.jerseyNumber ?? "?"}
                      </span>
                      <span className="max-w-16 truncate text-[10px] text-white/90">
                        {studentName(m.studentId).split(" ")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              ),
          )}
        </div>
        <p className="mt-sm text-center text-xs text-muted-foreground">
          Illustrative line-up — arrangement is a mock, not a tactical
          recommendation.
        </p>
      </div>

      {/* Full squad */}
      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">
          Squad ({members.length})
        </h2>
        <div className="grid grid-cols-1 gap-xs sm:grid-cols-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded bg-surface-secondary text-xs font-semibold text-foreground">
                  {m.jerseyNumber ?? "–"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-foreground">
                    {studentName(m.studentId)}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.position}</p>
                </div>
              </div>
              <Badge tone={roleTone[m.role]}>{m.role}</Badge>
            </div>
          ))}
        </div>
        {reserves.length > 0 && (
          <p className="mt-sm text-xs text-muted-foreground">
            {reserves.length} reserve(s) available.
          </p>
        )}
      </div>
    </div>
  );
}
