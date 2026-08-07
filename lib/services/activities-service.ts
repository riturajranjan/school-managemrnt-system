import { getSnapshot, setState } from "@/lib/data/store";
import type {
  Certificate,
  ClubMembership,
  Competition,
  CompetitionParticipant,
  EventRegistration,
  EventStage,
  EventTask,
  FixtureStatus,
  HousePointEntry,
  HousePointReason,
  RegistrationStatus,
  SchoolEvent,
} from "@/lib/types/activities";
import { eventJourneyOrder } from "@/lib/types/activities";
import { generateId } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Events & the Event Journey lifecycle
// ---------------------------------------------------------------------------

export function setEventStage(eventId: string, stage: EventStage): Result {
  const now = new Date().toISOString();
  setState((db) => ({ ...db, schoolEvents: db.schoolEvents.map((e) => (e.id === eventId ? { ...e, stage, updatedAt: now } : e)) }));
  return { ok: true };
}

/** Advances an event to the next stage in the journey pipeline. Terminal
 * (archived) and cancelled events can't advance. */
export function advanceEventStage(eventId: string): Result {
  const db = getSnapshot();
  const event = db.schoolEvents.find((e) => e.id === eventId);
  if (!event) return { ok: false, error: "Event not found." };
  if (event.stage === "cancelled") return { ok: false, error: "A cancelled event cannot be advanced." };
  const idx = eventJourneyOrder.indexOf(event.stage);
  if (idx < 0 || idx >= eventJourneyOrder.length - 1) return { ok: false, error: "Event is already at the final stage." };
  return setEventStage(eventId, eventJourneyOrder[idx + 1]);
}

export function cancelEvent(eventId: string): Result {
  return setEventStage(eventId, "cancelled");
}

export type EventDraft = { title: string; category: SchoolEvent["category"]; startDate: string; venue: string; description?: string };

export function createEvent(draft: EventDraft): Result & { eventId?: string } {
  if (!draft.title.trim()) return { ok: false, error: "Event title is required." };
  if (!draft.startDate) return { ok: false, error: "A start date is required." };
  const db = getSnapshot();
  const now = new Date().toISOString();
  const event: SchoolEvent = {
    id: generateId("evt"),
    title: draft.title.trim(),
    code: `EVT-${String(db.schoolEvents.length + 1).padStart(3, "0")}`,
    category: draft.category,
    stage: "idea",
    description: draft.description?.trim() || `${draft.title.trim()} — draft event.`,
    startDate: draft.startDate,
    endDate: draft.startDate,
    startTime: "09:00",
    endTime: "13:00",
    allDay: false,
    venue: draft.venue.trim() || "To be decided",
    audience: ["all-school"],
    organiserName: "Activities Office",
    organiserRole: "Activities Coordinator",
    coordinatorIds: [],
    registrationMode: "none",
    capacity: undefined,
    registeredCount: 0,
    attendedCount: 0,
    houseLinked: false,
    featured: false,
    bannerTone: "info",
    createdAt: now,
    updatedAt: now,
  };
  setState((current) => ({ ...current, schoolEvents: [event, ...current.schoolEvents] }));
  return { ok: true, eventId: event.id };
}

export function setEventTaskStatus(taskId: string, status: EventTask["status"]): Result {
  setState((db) => ({ ...db, eventTasks: db.eventTasks.map((t) => (t.id === taskId ? { ...t, status } : t)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Registration & attendance
// ---------------------------------------------------------------------------

/** Registers a student for an event. Guards (in frontend state) against
 * duplicate registration and respects capacity (waitlists when full). */
export function registerForEvent(eventId: string, studentId: string, role: EventRegistration["role"] = "participant"): Result & { status?: RegistrationStatus } {
  const db = getSnapshot();
  const event = db.schoolEvents.find((e) => e.id === eventId);
  if (!event) return { ok: false, error: "Event not found." };
  if (event.registrationMode === "none") return { ok: false, error: "This event does not require registration." };
  if (db.eventRegistrations.some((r) => r.eventId === eventId && r.studentId === studentId && r.status !== "withdrawn" && r.status !== "declined")) {
    return { ok: false, error: "This student is already registered." };
  }
  const confirmedCount = db.eventRegistrations.filter((r) => r.eventId === eventId && (r.status === "confirmed" || r.status === "pending")).length;
  const atCapacity = event.capacity != null && confirmedCount >= event.capacity;
  const status: RegistrationStatus = atCapacity ? "waitlisted" : event.registrationMode === "approval" ? "pending" : "confirmed";
  const registration: EventRegistration = { id: generateId("reg"), eventId, studentId, registeredAt: new Date().toISOString().slice(0, 10), status, role, notes: undefined };
  setState((current) => ({
    ...current,
    eventRegistrations: [registration, ...current.eventRegistrations],
    schoolEvents: current.schoolEvents.map((e) => (e.id === eventId && status !== "waitlisted" ? { ...e, registeredCount: e.registeredCount + 1 } : e)),
  }));
  return { ok: true, status };
}

export function setRegistrationStatus(registrationId: string, status: RegistrationStatus): Result {
  setState((db) => ({ ...db, eventRegistrations: db.eventRegistrations.map((r) => (r.id === registrationId ? { ...r, status } : r)) }));
  return { ok: true };
}

export function markEventAttendance(eventId: string, studentId: string, present: boolean): Result {
  const db = getSnapshot();
  const existing = db.eventAttendance.find((a) => a.eventId === eventId && a.studentId === studentId);
  const now = new Date();
  setState((current) => {
    const next = existing
      ? current.eventAttendance.map((a) => (a.id === existing.id ? { ...a, present, checkInTime: present ? now.toTimeString().slice(0, 5) : undefined } : a))
      : [{ id: generateId("eatt"), eventId, studentId, present, checkInTime: present ? now.toTimeString().slice(0, 5) : undefined, method: "manual" as const }, ...current.eventAttendance];
    return { ...current, eventAttendance: next };
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Clubs
// ---------------------------------------------------------------------------

export function joinClub(clubId: string, studentId: string): Result {
  const db = getSnapshot();
  const club = db.clubs.find((c) => c.id === clubId);
  if (!club) return { ok: false, error: "Club not found." };
  if (db.clubMemberships.some((m) => m.clubId === clubId && m.studentId === studentId && m.status !== "alumni")) {
    return { ok: false, error: "This student is already a member." };
  }
  if (club.memberCount >= club.capacity) return { ok: false, error: "This club is at full capacity." };
  const membership: ClubMembership = { id: generateId("cm"), clubId, studentId, role: "member", joinedAt: new Date().toISOString().slice(0, 10), status: club.status === "recruiting" ? "active" : "pending" };
  setState((current) => ({
    ...current,
    clubMemberships: [membership, ...current.clubMemberships],
    clubs: current.clubs.map((c) => (c.id === clubId ? { ...c, memberCount: c.memberCount + 1 } : c)),
  }));
  return { ok: true };
}

export function setMembershipStatus(membershipId: string, status: ClubMembership["status"]): Result {
  setState((db) => ({ ...db, clubMemberships: db.clubMemberships.map((m) => (m.id === membershipId ? { ...m, status } : m)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sports fixtures & tournaments
// ---------------------------------------------------------------------------

export function setFixtureResult(fixtureId: string, homeScore: number, awayScore: number): Result {
  if (homeScore < 0 || awayScore < 0) return { ok: false, error: "Scores cannot be negative." };
  setState((db) => ({ ...db, fixtures: db.fixtures.map((f) => (f.id === fixtureId ? { ...f, homeScore, awayScore, status: "completed" } : f)) }));
  return { ok: true };
}

export function setFixtureStatus(fixtureId: string, status: FixtureStatus): Result {
  setState((db) => ({ ...db, fixtures: db.fixtures.map((f) => (f.id === fixtureId ? { ...f, status } : f)) }));
  return { ok: true };
}

export function setBracketResult(matchId: string, scoreA: number, scoreB: number): Result {
  const db = getSnapshot();
  const match = db.bracketMatches.find((m) => m.id === matchId);
  if (!match) return { ok: false, error: "Match not found." };
  if (!match.teamA || !match.teamB) return { ok: false, error: "Both teams must be set before recording a result." };
  if (scoreA === scoreB) return { ok: false, error: "A knockout match cannot end in a draw." };
  const winner = scoreA > scoreB ? match.teamA : match.teamB;
  setState((current) => {
    const brackets = current.bracketMatches.map((m) => (m.id === matchId ? { ...m, scoreA, scoreB, winner, status: "completed" as FixtureStatus } : m));
    // Feed the winner into the next round's open slot within the same tournament.
    const nextRound = current.bracketMatches
      .filter((m) => m.tournamentId === match.tournamentId && m.round === match.round + 1)
      .sort((a, b) => a.slot - b.slot);
    const target = nextRound[Math.floor((match.slot - 1) / 2)];
    if (target) {
      const useA = (match.slot - 1) % 2 === 0;
      return { ...current, bracketMatches: brackets.map((m) => (m.id === target.id ? { ...m, [useA ? "teamA" : "teamB"]: winner } : m)) };
    }
    return { ...current, bracketMatches: brackets };
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Competitions — human-entered scoring (no AI). Each criterion score is
// entered by a judge; the service only tallies weighted totals.
// ---------------------------------------------------------------------------

export function recordCompetitionScore(participantId: string, criterionId: string, score: number): Result {
  const db = getSnapshot();
  const participant = db.competitionParticipants.find((p) => p.id === participantId);
  if (!participant) return { ok: false, error: "Participant not found." };
  const comp = db.competitions.find((c) => c.id === participant.competitionId);
  const criterion = comp?.criteria.find((cr) => cr.id === criterionId);
  if (!criterion) return { ok: false, error: "Scoring criterion not found." };
  if (score < 0 || score > criterion.maxScore) return { ok: false, error: `Score must be between 0 and ${criterion.maxScore}.` };
  setState((current) => ({
    ...current,
    competitionParticipants: current.competitionParticipants.map((p) => {
      if (p.id !== participantId) return p;
      const scores = { ...p.scores, [criterionId]: score };
      const total = comp!.criteria.reduce((sum, cr) => sum + (scores[cr.id] != null ? (scores[cr.id] / cr.maxScore) * cr.weight : 0), 0);
      return { ...p, scores, totalScore: Math.round(total * 10) / 10, status: "scored" };
    }),
  }));
  return { ok: true };
}

export function setCompetitionStatus(competitionId: string, status: Competition["status"]): Result {
  setState((db) => ({ ...db, competitions: db.competitions.map((c) => (c.id === competitionId ? { ...c, status } : c)) }));
  return { ok: true };
}

export function addCompetitionCriterion(competitionId: string, label: string, maxScore: number, weight: number): Result {
  if (!label.trim()) return { ok: false, error: "Criterion label is required." };
  if (maxScore <= 0) return { ok: false, error: "Max score must be positive." };
  setState((db) => ({
    ...db,
    competitions: db.competitions.map((c) => (c.id === competitionId ? { ...c, criteria: [...c.criteria, { id: generateId("crit"), label: label.trim(), maxScore, weight }] } : c)),
  }));
  return { ok: true };
}

export function setParticipant(competitionId: string, studentId: string): Result {
  const db = getSnapshot();
  const comp = db.competitions.find((c) => c.id === competitionId);
  if (!comp) return { ok: false, error: "Competition not found." };
  if (db.competitionParticipants.some((p) => p.competitionId === competitionId && p.studentId === studentId)) {
    return { ok: false, error: "This student is already entered." };
  }
  const student = db.students.find((s) => s.id === studentId);
  const house = db.houses.find((h) => h.name === student?.profile.house);
  const participant: CompetitionParticipant = {
    id: generateId("cp"),
    competitionId,
    studentId,
    houseId: comp.houseLinked ? house?.id : undefined,
    entryNumber: `E${String(db.competitionParticipants.filter((p) => p.competitionId === competitionId).length + 1).padStart(2, "0")}`,
    status: "registered",
    scores: {},
    totalScore: undefined,
  };
  setState((current) => ({
    ...current,
    competitionParticipants: [participant, ...current.competitionParticipants],
    competitions: current.competitions.map((c) => (c.id === competitionId ? { ...c, participantCount: c.participantCount + 1 } : c)),
  }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// House points — append-only ledger. Awarding is always a manual, attributed
// action. Totals & ranks are recomputed from the ledger, never edited directly.
// ---------------------------------------------------------------------------

export function awardHousePoints(input: { houseId: string; points: number; reason: HousePointReason; description: string; awardedBy: string; awardedByRole: string; sourceId?: string }): Result {
  const db = getSnapshot();
  if (!db.houses.some((h) => h.id === input.houseId)) return { ok: false, error: "House not found." };
  if (input.points === 0) return { ok: false, error: "Points must be non-zero." };
  if (!input.description.trim()) return { ok: false, error: "A description is required for the audit trail." };
  const entry: HousePointEntry = {
    id: generateId("hp"),
    houseId: input.houseId,
    points: input.points,
    reason: input.reason,
    description: input.description.trim(),
    sourceId: input.sourceId,
    awardedBy: input.awardedBy,
    awardedByRole: input.awardedByRole,
    awardedAt: new Date().toISOString(),
  };
  setState((current) => {
    const housePoints = [entry, ...current.housePoints];
    const houses = current.houses.map((h) => ({ ...h, totalPoints: housePoints.filter((e) => e.houseId === h.id).reduce((s, e) => s + e.points, 0) }));
    [...houses].sort((a, b) => b.totalPoints - a.totalPoints).forEach((h, i) => { h.rank = i + 1; });
    return { ...current, housePoints, houses };
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Certificates — mock print artefacts (serial is opaque, not verifiable).
// ---------------------------------------------------------------------------

export function issueCertificate(input: { templateId: string; recipientName: string; studentId?: string; eventTitle: string; position?: Certificate["position"]; issuedBy: string }): Result & { certificateId?: string } {
  if (!input.recipientName.trim()) return { ok: false, error: "Recipient name is required." };
  const db = getSnapshot();
  if (!db.certificateTemplates.some((t) => t.id === input.templateId)) return { ok: false, error: "Template not found." };
  const today = new Date().toISOString().slice(0, 10);
  const certificate: Certificate = {
    id: generateId("cert"),
    templateId: input.templateId,
    serial: `NC-${today.replace(/-/g, "")}-${String(1000 + db.certificates.length)}`,
    recipientName: input.recipientName.trim(),
    studentId: input.studentId,
    eventTitle: input.eventTitle,
    position: input.position,
    issuedDate: today,
    issuedBy: input.issuedBy,
    status: "issued",
  };
  setState((current) => ({ ...current, certificates: [certificate, ...current.certificates] }));
  return { ok: true, certificateId: certificate.id };
}

export function setCertificateStatus(certificateId: string, status: Certificate["status"]): Result {
  setState((db) => ({ ...db, certificates: db.certificates.map((c) => (c.id === certificateId ? { ...c, status } : c)) }));
  return { ok: true };
}
