import type { Student } from "@/lib/types/students";
import type { Teacher } from "@/lib/types/academics";
import type {
  Achievement,
  Award,
  BracketMatch,
  Certificate,
  CertificateTemplate,
  Club,
  ClubMeeting,
  ClubMembership,
  Competition,
  CompetitionParticipant,
  EventAttendance,
  EventBudgetLine,
  EventRegistration,
  EventResult,
  EventStage,
  EventTask,
  Fixture,
  House,
  HousePointEntry,
  HousePointReason,
  SchoolEvent,
  Sport,
  SportsTeam,
  TeamMember,
  Tournament,
} from "@/lib/types/activities";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(11112026);

function daysAgo(n: number) { return helpers.daysAgoIso(n).slice(0, 10); }
function daysFromNow(n: number) { return helpers.daysFromNowIso(n).slice(0, 10); }
function isoTime(hoursAgo: number) { const d = new Date("2026-08-05T14:00:00Z"); d.setHours(d.getHours() - hoursAgo); return d.toISOString(); }

// House crest metadata keyed by the house names the student seed already uses
// (Aravali / Nilgiri / Vindhya / Satpura). We never invent new houses — we read
// whatever distinct houses exist on the students.
const HOUSE_META: Record<string, { motto: string; color: string; emblem: string }> = {
  Aravali: { motto: "Strength in stillness", color: "#c2410c", emblem: "🏔️" },
  Nilgiri: { motto: "Rise above", color: "#1d4ed8", emblem: "🦅" },
  Vindhya: { motto: "Rooted and rising", color: "#15803d", emblem: "🌳" },
  Satpura: { motto: "Bold and boundless", color: "#7c3aed", emblem: "🐆" },
};
const DEFAULT_META = { motto: "Together we grow", color: "#0891b2", emblem: "🛡️" };

export function buildActivitiesData(students: Student[], teachers: Teacher[]) {
  const studentName = (id: string) => { const s = students.find((x) => x.id === id); return s ? `${s.profile.firstName} ${s.profile.lastName}` : id; };
  const teacherName = (t: Teacher) => t.name;
  const activeTeachers = teachers.filter((t) => t.status === "active");
  const pickTeacher = () => helpers.pick(activeTeachers.length ? activeTeachers : teachers);

  // -------------------------------------------------------------------------
  // Houses — derived from students' profile.house, never hardcoded.
  // -------------------------------------------------------------------------
  const houseNames = Array.from(new Set(students.map((s) => s.profile.house).filter((h): h is string => Boolean(h))));
  const orderedHouseNames = houseNames.length ? houseNames : ["Aravali", "Nilgiri", "Vindhya", "Satpura"];

  const houses: House[] = orderedHouseNames.map((name, i) => {
    const meta = HOUSE_META[name] ?? DEFAULT_META;
    const memberCount = students.filter((s) => s.profile.house === name).length;
    const captain = students.find((s) => s.profile.house === name);
    return {
      id: `house-${i + 1}`,
      name,
      motto: meta.motto,
      color: meta.color,
      emblem: meta.emblem,
      captainName: captain ? `${captain.profile.firstName} ${captain.profile.lastName}` : "—",
      captainId: captain?.id,
      houseMasterName: teacherName(pickTeacher()),
      memberCount,
      totalPoints: 0, // recomputed from the ledger below
      rank: 0,
    };
  });
  const houseByName = (name?: string) => houses.find((h) => h.name === name);

  // -------------------------------------------------------------------------
  // Events — a spread across the journey pipeline, past and future.
  // -------------------------------------------------------------------------
  const eventSeed: { title: string; category: SchoolEvent["category"]; stage: EventStage; offset: number; venue: string; house: boolean; featured?: boolean }[] = [
    { title: "Annual Day Celebration", category: "celebration", stage: "planning", offset: 40, venue: "Main Auditorium", house: true, featured: true },
    { title: "Inter-House Sports Meet", category: "sports", stage: "promotion", offset: 18, venue: "Athletics Ground", house: true, featured: true },
    { title: "Science Exhibition 2026", category: "science", stage: "approved", offset: 25, venue: "Science Block", house: false, featured: true },
    { title: "Founders' Day Assembly", category: "assembly", stage: "completed", offset: -12, venue: "Quadrangle", house: false },
    { title: "Cultural Fest — Rangmanch", category: "cultural", stage: "planning", offset: 55, venue: "Open Air Theatre", house: true },
    { title: "Independence Day Function", category: "celebration", stage: "live", offset: 0, venue: "Assembly Ground", house: false, featured: true },
    { title: "Inter-School Debate", category: "academic", stage: "idea", offset: 70, venue: "Seminar Hall", house: false },
    { title: "Art & Craft Mela", category: "arts", stage: "promotion", offset: 14, venue: "Activity Centre", house: true },
    { title: "Community Cleanliness Drive", category: "community", stage: "completed", offset: -20, venue: "School Neighbourhood", house: true },
    { title: "Robotics Workshop", category: "workshop", stage: "approved", offset: 30, venue: "Computer Lab", house: false },
    { title: "Music Concert Evening", category: "cultural", stage: "planning", offset: 48, venue: "Amphitheatre", house: false },
    { title: "Winter Carnival", category: "celebration", stage: "idea", offset: 120, venue: "Sports Complex", house: true },
  ];

  const events: SchoolEvent[] = eventSeed.map((e, i) => {
    const isPast = e.offset < 0;
    const capacity = helpers.int(60, 300);
    const registeredCount = e.stage === "idea" ? 0 : helpers.int(20, Math.min(capacity, 220));
    const attendedCount = isPast || e.stage === "completed" || e.stage === "live" ? Math.round(registeredCount * (0.7 + helpers.rand() * 0.25)) : 0;
    return {
      id: `evt-${i + 1}`,
      title: e.title,
      code: `EVT-${String(i + 1).padStart(3, "0")}`,
      category: e.category,
      stage: e.stage,
      description: `${e.title} — a school-wide activity coordinated by the activities office.`,
      startDate: daysFromNow(e.offset),
      endDate: daysFromNow(e.offset + (helpers.bool(0.3) ? 1 : 0)),
      startTime: `${helpers.int(8, 11)}:00`,
      endTime: `${helpers.int(13, 17)}:00`,
      allDay: helpers.bool(0.25),
      venue: e.venue,
      audience: helpers.pickMany(["all-school", "primary", "middle", "senior", "parents"] as const, helpers.int(1, 2)),
      organiserName: teacherName(pickTeacher()),
      organiserRole: "Activities Coordinator",
      coordinatorIds: helpers.pickMany(activeTeachers, helpers.int(1, 3)).map((t) => t.id),
      registrationMode: helpers.pick(["open", "approval", "invite-only", "none"] as const),
      capacity,
      registeredCount,
      attendedCount,
      houseLinked: e.house,
      featured: Boolean(e.featured),
      bannerTone: helpers.pick(["info", "success", "warning", "neutral"] as const),
      createdAt: daysAgo(helpers.int(10, 90)),
      updatedAt: isoTime(helpers.int(1, 200)),
    };
  });

  // Event 360 workspace — tasks & budget for the featured/planning events.
  const taskTitles = ["Book venue", "Design posters", "Arrange sound system", "Confirm chief guest", "Prepare safety plan", "Coordinate volunteers", "Order refreshments", "Set up registration desk", "Rehearsal schedule", "Prizes & certificates"];
  const eventTasks: EventTask[] = events.filter((e) => ["planning", "approved", "promotion", "live"].includes(e.stage)).flatMap((e) =>
    helpers.pickMany(taskTitles, helpers.int(3, 6)).map((title, j) => ({
      id: `etask-${e.id}-${j}`,
      eventId: e.id,
      title,
      owner: teacherName(pickTeacher()),
      dueDate: daysFromNow(helpers.int(-3, 20)),
      status: helpers.pick(["todo", "in-progress", "done", "blocked"] as const),
      category: helpers.pick(["logistics", "promotion", "budget", "safety", "content", "volunteers"] as const),
    })),
  );

  const budgetLabels: { label: string; category: EventBudgetLine["category"] }[] = [
    { label: "Venue decoration", category: "venue" },
    { label: "Stage & backdrop", category: "materials" },
    { label: "Sound & lighting", category: "logistics" },
    { label: "Refreshments", category: "refreshments" },
    { label: "Trophies & medals", category: "prizes" },
    { label: "Printing & stationery", category: "misc" },
  ];
  const eventBudget: EventBudgetLine[] = events.filter((e) => ["planning", "approved", "promotion", "live", "completed"].includes(e.stage)).flatMap((e) =>
    helpers.pickMany(budgetLabels, helpers.int(3, 6)).map((b, j) => {
      const estimated = helpers.int(2, 40) * 500;
      const done = ["live", "completed"].includes(e.stage);
      return { id: `ebud-${e.id}-${j}`, eventId: e.id, label: b.label, category: b.category, estimated, actual: done ? Math.round(estimated * (0.85 + helpers.rand() * 0.3)) : undefined };
    }),
  );

  // Registrations & attendance for events open enough to register.
  const registrations: EventRegistration[] = [];
  const attendance: EventAttendance[] = [];
  events.filter((e) => e.registeredCount > 0).forEach((e) => {
    const regStudents = helpers.pickMany(students, Math.min(e.registeredCount, 24));
    regStudents.forEach((s, j) => {
      const status = helpers.pick(["confirmed", "confirmed", "confirmed", "pending", "waitlisted", "declined"] as const);
      registrations.push({ id: `reg-${e.id}-${j}`, eventId: e.id, studentId: s.id, registeredAt: daysAgo(helpers.int(1, 30)), status, role: helpers.pick(["participant", "participant", "volunteer", "performer", "spectator"] as const), notes: undefined });
      if ((e.stage === "completed" || e.stage === "live") && status === "confirmed") {
        const present = helpers.bool(0.85);
        attendance.push({ id: `eatt-${e.id}-${j}`, eventId: e.id, studentId: s.id, present, checkInTime: present ? `${helpers.int(8, 12)}:${helpers.pick(["05", "20", "40"])}` : undefined, method: helpers.pick(["manual", "roster", "token"] as const) });
      }
    });
  });

  // Event results (past/completed events with house links award points).
  const results: EventResult[] = [];
  events.filter((e) => e.stage === "completed").forEach((e) => {
    const positions = ["1st", "2nd", "3rd"] as const;
    positions.forEach((position, k) => {
      const s = helpers.pick(students);
      const house = houseByName(s.profile.house);
      results.push({ id: `eres-${e.id}-${k}`, eventId: e.id, studentId: s.id, houseId: e.houseLinked ? house?.id : undefined, teamName: undefined, position, points: e.houseLinked ? [50, 30, 20][k] : 0, citation: `${position} place in ${e.title}`, recordedBy: teacherName(pickTeacher()), recordedAt: daysAgo(helpers.int(1, 15)) });
    });
  });

  // -------------------------------------------------------------------------
  // Clubs — memberships & meetings.
  // -------------------------------------------------------------------------
  const clubSeed: { name: string; category: Club["category"]; schedule: string; venue: string }[] = [
    { name: "Astronomy Club", category: "science", schedule: "Fri 3:30 PM", venue: "Science Block" },
    { name: "Drama Society", category: "arts", schedule: "Wed 4:00 PM", venue: "Auditorium" },
    { name: "Coding Club", category: "technology", schedule: "Tue 3:30 PM", venue: "Computer Lab" },
    { name: "Eco Warriors", category: "environment", schedule: "Mon 3:30 PM", venue: "Garden" },
    { name: "Debate & MUN", category: "debate", schedule: "Thu 4:00 PM", venue: "Seminar Hall" },
    { name: "Music Ensemble", category: "music", schedule: "Fri 4:00 PM", venue: "Music Room" },
    { name: "Literary Circle", category: "literary", schedule: "Wed 3:30 PM", venue: "Library" },
    { name: "Community Service League", category: "service", schedule: "Sat 10:00 AM", venue: "Activity Centre" },
    { name: "Photography & Media", category: "media", schedule: "Tue 4:00 PM", venue: "Media Room" },
    { name: "Robotics Guild", category: "technology", schedule: "Thu 3:30 PM", venue: "Innovation Lab" },
  ];
  const clubs: Club[] = clubSeed.map((c, i) => {
    const capacity = helpers.int(25, 50);
    return { id: `club-${i + 1}`, name: c.name, code: `CLB-${String(i + 1).padStart(3, "0")}`, category: c.category, description: `${c.name} brings together students passionate about ${c.category}.`, facultyAdvisor: teacherName(pickTeacher()), advisorId: pickTeacher().id, meetingSchedule: c.schedule, venue: c.venue, memberCount: 0, capacity, status: helpers.pick(["active", "active", "recruiting", "paused"] as const), foundedYear: helpers.int(2015, 2024), bannerTone: helpers.pick(["info", "success", "warning", "neutral"] as const) };
  });

  const clubMemberships: ClubMembership[] = [];
  clubs.forEach((club) => {
    const count = helpers.int(12, Math.min(club.capacity, 30));
    const members = helpers.pickMany(students, count);
    members.forEach((s, j) => {
      const role = j === 0 ? "president" : j === 1 ? "vice-president" : j === 2 ? "secretary" : j === 3 ? "treasurer" : "member";
      clubMemberships.push({ id: `cm-${club.id}-${j}`, clubId: club.id, studentId: s.id, role, joinedAt: daysAgo(helpers.int(30, 400)), status: helpers.pick(["active", "active", "active", "pending"] as const) });
    });
    club.memberCount = members.length;
  });

  const meetingAgendas = ["Plan upcoming showcase", "Project review", "Guest speaker session", "Skill workshop", "Election of office bearers", "Progress check-in", "Prepare for inter-school event"];
  const clubMeetings: ClubMeeting[] = clubs.flatMap((club) =>
    Array.from({ length: helpers.int(2, 4) }, (_, j) => {
      const offset = helpers.int(-30, 20);
      const status = offset < -1 ? "completed" : offset > 1 ? "scheduled" : helpers.pick(["scheduled", "completed"] as const);
      return { id: `cmt-${club.id}-${j}`, clubId: club.id, title: `${club.name} meeting`, date: daysFromNow(offset), time: club.meetingSchedule.split(" ").slice(1).join(" ") || "15:30", venue: club.venue, agenda: helpers.pick(meetingAgendas), status: status as ClubMeeting["status"], attendanceMock: Math.round(club.memberCount * (0.6 + helpers.rand() * 0.35)), minutes: status === "completed" ? "Discussed agenda; action items assigned." : undefined };
    }),
  );

  // -------------------------------------------------------------------------
  // Sports — sports, teams, members, fixtures, tournaments, brackets.
  // -------------------------------------------------------------------------
  const sportSeed: { name: string; category: Sport["category"]; season: Sport["season"] }[] = [
    { name: "Football", category: "team", season: "monsoon" },
    { name: "Basketball", category: "team", season: "winter" },
    { name: "Cricket", category: "team", season: "summer" },
    { name: "Athletics", category: "athletics", season: "winter" },
    { name: "Table Tennis", category: "racquet", season: "all-year" },
    { name: "Badminton", category: "racquet", season: "all-year" },
    { name: "Swimming", category: "aquatics", season: "summer" },
    { name: "Chess", category: "indoor", season: "all-year" },
  ];
  const sports: Sport[] = sportSeed.map((sp, i) => ({ id: `sport-${i + 1}`, name: sp.name, category: sp.category, season: sp.season, coachName: teacherName(pickTeacher()), coachId: pickTeacher().id, venue: helpers.pick(["Main Ground", "Indoor Arena", "Sports Complex", "Court 1", "Pool"]), teamCount: 0, playerCount: 0, status: helpers.pick(["active", "active", "off-season"] as const) }));

  const teams: SportsTeam[] = [];
  const teamMembers: TeamMember[] = [];
  sports.filter((sp) => sp.category === "team").forEach((sp) => {
    const ageGroups: SportsTeam["ageGroup"][] = ["u14", "u16", "u19"];
    ageGroups.forEach((ageGroup, gi) => {
      const gender = helpers.pick(["boys", "girls"] as const);
      const teamId = `team-${sp.id}-${gi}`;
      const house = helpers.pick(houses);
      const squad = helpers.pickMany(students, helpers.int(11, 16));
      const wins = helpers.int(0, 8), losses = helpers.int(0, 6), draws = helpers.int(0, 3);
      teams.push({ id: teamId, sportId: sp.id, name: `${sp.name} ${ageGroup.toUpperCase()} ${gender === "boys" ? "Boys" : "Girls"}`, ageGroup, gender, captainId: squad[0]?.id, coachName: sp.coachName, memberCount: squad.length, wins, losses, draws, houseId: house.id });
      squad.forEach((s, j) => {
        const role = j === 0 ? "captain" : j === 1 ? "vice-captain" : j < 11 ? "player" : "reserve";
        teamMembers.push({ id: `tm-${teamId}-${j}`, teamId, studentId: s.id, position: helpers.pick(["Forward", "Midfield", "Defence", "Goalkeeper", "All-rounder", "Opener"]), jerseyNumber: j + 1, role, status: role === "reserve" ? "reserve" : helpers.pick(["selected", "selected", "trial", "injured"] as const) });
      });
      sp.teamCount += 1;
      sp.playerCount += squad.length;
    });
  });

  // Tournaments (one knockout with a full bracket + one league).
  const tournaments: Tournament[] = [
    { id: "trn-1", name: "Inter-House Football Cup", sportId: "sport-1", format: "knockout", startDate: daysFromNow(-6), endDate: daysFromNow(8), teamCount: 4, status: "ongoing" },
    { id: "trn-2", name: "Basketball League", sportId: "sport-2", format: "league", startDate: daysFromNow(-20), endDate: daysFromNow(-2), teamCount: 4, status: "completed", championTeam: `${houses[0]?.name ?? "House A"} Ballers`, runnerUpTeam: `${houses[1]?.name ?? "House B"} Hoops` },
    { id: "trn-3", name: "Cricket Championship", sportId: "sport-3", format: "group-knockout", startDate: daysFromNow(10), endDate: daysFromNow(30), teamCount: 4, status: "upcoming" },
  ];

  // Knockout bracket for the football cup — semis + final over 2 rounds.
  const bracketTeams = houses.slice(0, 4).map((h) => `${h.name} FC`);
  while (bracketTeams.length < 4) bracketTeams.push(`Team ${bracketTeams.length + 1}`);
  const semiFinalists = [bracketTeams[0], bracketTeams[1], bracketTeams[2], bracketTeams[3]];
  const semi1Winner = semiFinalists[0];
  const semi2Winner = semiFinalists[2];
  const brackets: BracketMatch[] = [
    { id: "brk-1", tournamentId: "trn-1", round: 1, roundLabel: "Semi-final", slot: 1, teamA: semiFinalists[0], teamB: semiFinalists[1], scoreA: 3, scoreB: 1, winner: semi1Winner, status: "completed" },
    { id: "brk-2", tournamentId: "trn-1", round: 1, roundLabel: "Semi-final", slot: 2, teamA: semiFinalists[2], teamB: semiFinalists[3], scoreA: 2, scoreB: 2, winner: semi2Winner, status: "completed" },
    { id: "brk-3", tournamentId: "trn-1", round: 2, roundLabel: "Final", slot: 1, teamA: semi1Winner, teamB: semi2Winner, status: "scheduled" },
  ];

  // Fixtures — mix of scheduled, live and completed.
  const fixtures: Fixture[] = [];
  sports.filter((sp) => sp.category === "team").forEach((sp, si) => {
    const spTeams = teams.filter((t) => t.sportId === sp.id);
    for (let k = 0; k < 4; k++) {
      const offset = helpers.int(-14, 14);
      const status = offset < -1 ? "completed" : offset === 0 ? helpers.pick(["live", "scheduled"] as const) : "scheduled";
      const home = spTeams[k % spTeams.length]?.name ?? `${sp.name} A`;
      const away = spTeams[(k + 1) % spTeams.length]?.name ?? `${sp.name} B`;
      fixtures.push({ id: `fx-${si}-${k}`, sportId: sp.id, tournamentId: sp.id === "sport-1" ? "trn-1" : undefined, homeTeam: home, awayTeam: away, homeTeamId: spTeams[k % spTeams.length]?.id, awayTeamId: spTeams[(k + 1) % spTeams.length]?.id, date: daysFromNow(offset), time: `${helpers.int(9, 16)}:${helpers.pick(["00", "30"])}`, venue: sp.venue, status, homeScore: status === "completed" ? helpers.int(0, 4) : undefined, awayScore: status === "completed" ? helpers.int(0, 4) : undefined, round: sp.id === "sport-1" ? "Semi-final" : undefined });
    }
  });

  // -------------------------------------------------------------------------
  // Competitions — with configurable scoring criteria (human-judged only).
  // -------------------------------------------------------------------------
  const compSeed: { name: string; category: Competition["category"]; level: Competition["level"] }[] = [
    { name: "Inter-House Quiz", category: "academic", level: "inter-house" },
    { name: "Solo Singing Competition", category: "cultural", level: "open" },
    { name: "Science Model Contest", category: "science", level: "inter-class" },
    { name: "Painting Competition", category: "arts", level: "inter-house" },
    { name: "Elocution Contest", category: "academic", level: "open" },
    { name: "Rangoli Competition", category: "arts", level: "inter-house" },
  ];
  const criteriaSets: Record<string, { label: string; maxScore: number; weight: number }[]> = {
    default: [ { label: "Content", maxScore: 10, weight: 40 }, { label: "Presentation", maxScore: 10, weight: 35 }, { label: "Creativity", maxScore: 10, weight: 25 } ],
    singing: [ { label: "Pitch & Rhythm", maxScore: 10, weight: 40 }, { label: "Expression", maxScore: 10, weight: 30 }, { label: "Stage Presence", maxScore: 10, weight: 30 } ],
    science: [ { label: "Concept", maxScore: 10, weight: 35 }, { label: "Working Model", maxScore: 10, weight: 35 }, { label: "Explanation", maxScore: 10, weight: 30 } ],
  };
  const competitions: Competition[] = compSeed.map((c, i) => {
    const setKey = c.name.includes("Singing") ? "singing" : c.category === "science" ? "science" : "default";
    const criteria = criteriaSets[setKey].map((cr, ci) => ({ id: `crit-${i}-${ci}`, ...cr }));
    const status = helpers.pick(["open", "judging", "results-published", "closed"] as const);
    return { id: `comp-${i + 1}`, name: c.name, code: `CMP-${String(i + 1).padStart(3, "0")}`, category: c.category, description: `${c.name} — judged live by a panel of teachers.`, date: daysFromNow(helpers.int(-10, 25)), venue: helpers.pick(["Auditorium", "Activity Hall", "Art Room", "Seminar Hall"]), organiserName: teacherName(pickTeacher()), level: c.level, status, participantCount: 0, houseLinked: c.level === "inter-house", criteria };
  });

  const compParticipants: CompetitionParticipant[] = [];
  competitions.forEach((comp) => {
    const count = helpers.int(6, 12);
    const parts = helpers.pickMany(students, count);
    parts.forEach((s, j) => {
      const house = houseByName(s.profile.house);
      const scored = comp.status === "results-published" || comp.status === "judging" || comp.status === "closed";
      const scores: Record<string, number> = {};
      let total = 0;
      if (scored) {
        comp.criteria.forEach((cr) => { const val = helpers.int(Math.floor(cr.maxScore * 0.5), cr.maxScore); scores[cr.id] = val; total += (val / cr.maxScore) * cr.weight; });
      }
      compParticipants.push({ id: `cp-${comp.id}-${j}`, competitionId: comp.id, studentId: s.id, houseId: comp.houseLinked ? house?.id : undefined, entryNumber: `E${String(j + 1).padStart(2, "0")}`, status: scored ? "scored" : helpers.pick(["registered", "checked-in"] as const), scores, totalScore: scored ? Math.round(total * 10) / 10 : undefined });
    });
    comp.participantCount = parts.length;
  });

  // -------------------------------------------------------------------------
  // House points ledger (append-only, audit-style). Aggregate the sources
  // above plus some standalone awards, then recompute house totals & ranks.
  // -------------------------------------------------------------------------
  const housePoints: HousePointEntry[] = [];
  let hpCounter = 0;
  const addPoints = (houseId: string | undefined, points: number, reason: HousePointReason, description: string, sourceId?: string) => {
    if (!houseId || points === 0) return;
    hpCounter += 1;
    housePoints.push({ id: `hp-${hpCounter}`, houseId, points, reason, description, sourceId, awardedBy: teacherName(pickTeacher()), awardedByRole: helpers.pick(["Activities Coordinator", "House Master", "Sports Coordinator", "Principal"]), awardedAt: daysAgo(helpers.int(1, 40)) });
  };
  // From event results.
  results.filter((r) => r.houseId && r.points > 0).forEach((r) => addPoints(r.houseId, r.points, "event-result", r.citation, r.eventId));
  // From completed competitions (top scorers earn house points).
  competitions.filter((c) => c.houseLinked && c.status === "results-published").forEach((comp) => {
    const ranked = compParticipants.filter((p) => p.competitionId === comp.id && p.houseId && p.totalScore != null).sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
    ranked.slice(0, 3).forEach((p, k) => addPoints(p.houseId, [50, 30, 20][k], "competition", `${["1st", "2nd", "3rd"][k]} in ${comp.name}`, comp.id));
  });
  // From sports fixtures/tournaments and misc recognitions.
  houses.forEach((h) => {
    addPoints(h.id, helpers.int(20, 80), "sports", "Inter-house sports performance");
    addPoints(h.id, helpers.int(10, 50), "academic", "Academic honours board");
    addPoints(h.id, helpers.int(10, 40), "attendance", "Best attendance streak");
    addPoints(h.id, helpers.int(10, 30), "community-service", "Community service drive");
    if (helpers.bool(0.4)) addPoints(h.id, -helpers.int(5, 15), "discipline", "Discipline deduction");
    if (helpers.bool(0.5)) addPoints(h.id, helpers.int(10, 25), "special-recognition", "Special recognition by Principal");
  });
  // Recompute totals & ranks.
  houses.forEach((h) => { h.totalPoints = housePoints.filter((e) => e.houseId === h.id).reduce((s, e) => s + e.points, 0); });
  [...houses].sort((a, b) => b.totalPoints - a.totalPoints).forEach((h, i) => { h.rank = i + 1; });

  // -------------------------------------------------------------------------
  // Achievements, awards, certificates.
  // -------------------------------------------------------------------------
  const achievementTitles = ["1st in District Science Fair", "Gold Medal — State Swimming", "Best Speaker — Inter-School Debate", "National Chess Qualifier", "1st in Regional Art Contest", "Winner — Math Olympiad Round 1", "Runner-up — State Football", "Certificate of Merit — Essay Writing"];
  const achievements: Achievement[] = helpers.pickMany(students, 20).map((s, i) => ({ id: `ach-${i + 1}`, studentId: s.id, title: helpers.pick(achievementTitles), category: helpers.pick(["science", "sports", "academic", "arts", "cultural"] as const), level: helpers.pick(["school", "district", "state", "national"] as const), date: daysAgo(helpers.int(10, 300)), description: "Recognised for outstanding performance.", position: helpers.pick(["1st", "2nd", "3rd", "special"] as const), verifiedBy: helpers.bool(0.7) ? teacherName(pickTeacher()) : undefined, sourceEventId: undefined }));

  const awards: Award[] = [
    ...houses.slice(0, 1).map((h, i) => ({ id: `awd-h${i}`, name: "House of the Term", type: "trophy" as const, category: "celebration" as const, recipientType: "house" as const, recipientId: h.id, recipientName: `${h.name} House`, citation: "Highest house points this term.", awardedAt: daysAgo(5), ceremony: "Morning Assembly", presentedBy: "Principal" })),
    ...helpers.pickMany(students, 5).map((s, i) => ({ id: `awd-s${i}`, name: helpers.pick(["Best All-Rounder", "Sportsperson of the Year", "Young Scientist", "Cultural Star", "Community Champion"]), type: helpers.pick(["medal", "shield", "title", "certificate"] as const), category: helpers.pick(["academic", "sports", "science", "cultural", "community"] as const), recipientType: "student" as const, recipientId: s.id, recipientName: studentName(s.id), citation: "Awarded for consistent excellence and spirit.", awardedAt: daysAgo(helpers.int(2, 40)), ceremony: helpers.pick(["Annual Day", "Sports Day", "Morning Assembly"]), presentedBy: helpers.pick(["Principal", "Chief Guest", "House Master"]) })),
  ];

  const certificateTemplates: CertificateTemplate[] = [
    { id: "ctpl-1", name: "Participation — Classic", purpose: "participation", orientation: "landscape", accentColor: "#0891b2", borderStyle: "classic", bodyText: "This certifies that {name} participated in {event} held on {date}.", signatoryTitle: "Activities Coordinator", showSeal: true },
    { id: "ctpl-2", name: "Merit — Modern", purpose: "merit", orientation: "landscape", accentColor: "#7c3aed", borderStyle: "modern", bodyText: "Awarded to {name} for securing {position} in {event} on {date}.", signatoryTitle: "Principal", showSeal: true },
    { id: "ctpl-3", name: "Achievement — Ornate", purpose: "achievement", orientation: "portrait", accentColor: "#c2410c", borderStyle: "ornate", bodyText: "In recognition of the outstanding achievement of {name} in {event}, {date}.", signatoryTitle: "Principal", showSeal: true },
    { id: "ctpl-4", name: "Appreciation — Minimal", purpose: "appreciation", orientation: "landscape", accentColor: "#15803d", borderStyle: "minimal", bodyText: "With sincere appreciation to {name} for valuable contribution to {event}.", signatoryTitle: "Coordinator", showSeal: false },
  ];

  const certificates: Certificate[] = helpers.pickMany(students, 12).map((s, i) => {
    const tpl = helpers.pick(certificateTemplates);
    const ev = helpers.pick(events);
    return { id: `cert-${i + 1}`, templateId: tpl.id, serial: `NC-${daysAgo(0).replace(/-/g, "")}-${String(1000 + i)}`, recipientName: studentName(s.id), studentId: s.id, eventTitle: ev.title, position: tpl.purpose === "merit" || tpl.purpose === "achievement" ? helpers.pick(["1st", "2nd", "3rd"] as const) : "participation", issuedDate: daysAgo(helpers.int(1, 30)), issuedBy: teacherName(pickTeacher()), status: helpers.pick(["issued", "issued", "draft"] as const) };
  });

  return {
    houses,
    events,
    eventTasks,
    eventBudget,
    registrations,
    attendance,
    results,
    clubs,
    clubMemberships,
    clubMeetings,
    sports,
    teams,
    teamMembers,
    fixtures,
    tournaments,
    brackets,
    competitions,
    compParticipants,
    housePoints,
    achievements,
    awards,
    certificateTemplates,
    certificates,
  };
}
