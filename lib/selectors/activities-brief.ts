import type { Db } from "@/lib/data/store";
import type { ActivityParticipationSummary } from "@/lib/types/activities";

const TODAY = () => new Date().toISOString().slice(0, 10);

export type ActivitiesSummary = {
  totalEvents: number;
  upcomingEvents: number;
  liveEvents: number;
  eventsInPlanning: number;
  totalClubs: number;
  clubMembers: number;
  sportsTeams: number;
  activeTournaments: number;
  openCompetitions: number;
  totalHousePoints: number;
  certificatesIssued: number;
  achievements: number;
};

export function activitiesSummary(db: Db): ActivitiesSummary {
  const today = TODAY();
  return {
    totalEvents: db.schoolEvents.filter((e) => e.stage !== "cancelled").length,
    upcomingEvents: db.schoolEvents.filter((e) => e.startDate >= today && e.stage !== "cancelled" && e.stage !== "completed").length,
    liveEvents: db.schoolEvents.filter((e) => e.stage === "live").length,
    eventsInPlanning: db.schoolEvents.filter((e) => e.stage === "planning" || e.stage === "approved").length,
    totalClubs: db.clubs.length,
    clubMembers: db.clubMemberships.filter((m) => m.status === "active").length,
    sportsTeams: db.sportsTeams.length,
    activeTournaments: db.tournaments.filter((t) => t.status === "ongoing").length,
    openCompetitions: db.competitions.filter((c) => c.status === "open" || c.status === "judging").length,
    totalHousePoints: db.housePoints.reduce((s, e) => s + e.points, 0),
    certificatesIssued: db.certificates.filter((c) => c.status === "issued").length,
    achievements: db.achievements.length,
  };
}

/** House standings ordered by total points (podium-ready). Pure read — totals
 * are already maintained by the service layer from the points ledger. */
export function houseStandings(db: Db) {
  return [...db.houses].sort((a, b) => b.totalPoints - a.totalPoints);
}

/** Aggregate participation counts for a single student — powers the student
 * Activity Portfolio. Counts of involvement only; never a score or ranking. */
export function studentParticipation(db: Db, studentId: string): ActivityParticipationSummary {
  return {
    studentId,
    eventsAttended: db.eventAttendance.filter((a) => a.studentId === studentId && a.present).length,
    clubsJoined: db.clubMemberships.filter((m) => m.studentId === studentId && m.status !== "alumni").length,
    sportsTeams: db.teamMembers.filter((tm) => tm.studentId === studentId).length,
    competitionsEntered: db.competitionParticipants.filter((p) => p.studentId === studentId).length,
    achievements: db.achievements.filter((a) => a.studentId === studentId).length,
  };
}
