"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";

// Events
export function useSchoolEvents() { return useSisStore().schoolEvents; }
export function useSchoolEvent(eventId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.schoolEvents.find((e) => e.id === eventId), [db.schoolEvents, eventId]);
}
export function useEventTasks(eventId?: string) {
  const db = useSisStore();
  return useMemo(() => (eventId ? db.eventTasks.filter((t) => t.eventId === eventId) : db.eventTasks), [db.eventTasks, eventId]);
}
export function useEventBudget(eventId?: string) {
  const db = useSisStore();
  return useMemo(() => (eventId ? db.eventBudget.filter((b) => b.eventId === eventId) : db.eventBudget), [db.eventBudget, eventId]);
}
export function useEventRegistrations(eventId?: string) {
  const db = useSisStore();
  return useMemo(() => (eventId ? db.eventRegistrations.filter((r) => r.eventId === eventId) : db.eventRegistrations), [db.eventRegistrations, eventId]);
}
export function useEventAttendance(eventId?: string) {
  const db = useSisStore();
  return useMemo(() => (eventId ? db.eventAttendance.filter((a) => a.eventId === eventId) : db.eventAttendance), [db.eventAttendance, eventId]);
}
export function useEventResults(eventId?: string) {
  const db = useSisStore();
  return useMemo(() => (eventId ? db.eventResults.filter((r) => r.eventId === eventId) : db.eventResults), [db.eventResults, eventId]);
}

// Clubs
export function useClubs() { return useSisStore().clubs; }
export function useClub(clubId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.clubs.find((c) => c.id === clubId), [db.clubs, clubId]);
}
export function useClubMemberships(clubId?: string) {
  const db = useSisStore();
  return useMemo(() => (clubId ? db.clubMemberships.filter((m) => m.clubId === clubId) : db.clubMemberships), [db.clubMemberships, clubId]);
}
export function useClubMeetings(clubId?: string) {
  const db = useSisStore();
  return useMemo(() => (clubId ? db.clubMeetings.filter((m) => m.clubId === clubId) : db.clubMeetings), [db.clubMeetings, clubId]);
}

// Sports
export function useSports() { return useSisStore().sports; }
export function useSport(sportId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.sports.find((s) => s.id === sportId), [db.sports, sportId]);
}
export function useSportsTeams(sportId?: string) {
  const db = useSisStore();
  return useMemo(() => (sportId ? db.sportsTeams.filter((t) => t.sportId === sportId) : db.sportsTeams), [db.sportsTeams, sportId]);
}
export function useTeam(teamId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.sportsTeams.find((t) => t.id === teamId), [db.sportsTeams, teamId]);
}
export function useTeamMembers(teamId?: string) {
  const db = useSisStore();
  return useMemo(() => (teamId ? db.teamMembers.filter((m) => m.teamId === teamId) : db.teamMembers), [db.teamMembers, teamId]);
}
export function useFixtures(sportId?: string) {
  const db = useSisStore();
  return useMemo(() => (sportId ? db.fixtures.filter((f) => f.sportId === sportId) : db.fixtures), [db.fixtures, sportId]);
}
export function useTournaments() { return useSisStore().tournaments; }
export function useTournament(tournamentId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.tournaments.find((t) => t.id === tournamentId), [db.tournaments, tournamentId]);
}
export function useBracketMatches(tournamentId?: string) {
  const db = useSisStore();
  return useMemo(() => (tournamentId ? db.bracketMatches.filter((m) => m.tournamentId === tournamentId) : db.bracketMatches), [db.bracketMatches, tournamentId]);
}

// Competitions
export function useCompetitions() { return useSisStore().competitions; }
export function useCompetition(competitionId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.competitions.find((c) => c.id === competitionId), [db.competitions, competitionId]);
}
export function useCompetitionParticipants(competitionId?: string) {
  const db = useSisStore();
  return useMemo(() => (competitionId ? db.competitionParticipants.filter((p) => p.competitionId === competitionId) : db.competitionParticipants), [db.competitionParticipants, competitionId]);
}

// Houses
export function useHouses() { return useSisStore().houses; }
export function useHouse(houseId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.houses.find((h) => h.id === houseId), [db.houses, houseId]);
}
export function useHousePoints(houseId?: string) {
  const db = useSisStore();
  return useMemo(() => (houseId ? db.housePoints.filter((e) => e.houseId === houseId) : db.housePoints), [db.housePoints, houseId]);
}

// Achievements, awards, certificates
export function useAchievements(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.achievements.filter((a) => a.studentId === studentId) : db.achievements), [db.achievements, studentId]);
}
export function useAwards() { return useSisStore().awards; }
export function useCertificateTemplates() { return useSisStore().certificateTemplates; }
export function useCertificates(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.certificates.filter((c) => c.studentId === studentId) : db.certificates), [db.certificates, studentId]);
}
