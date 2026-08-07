import type { ID, StatusTone } from "./common";

// ===========================================================================
// Phase 11 — Events, Clubs, Sports, Competitions & House System.
// Frontend mock models only. No AI scoring, no personality/worth ranking of
// students. All participation data is aggregate/operational — the Campus
// Activity Pulse never diagnoses, scores or ranks an individual's character.
// Certificates are print-styled mock artefacts, not verifiable documents.
// ===========================================================================

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventCategory =
  | "cultural"
  | "sports"
  | "academic"
  | "arts"
  | "science"
  | "community"
  | "celebration"
  | "competition"
  | "workshop"
  | "assembly";

export const eventCategoryLabels: Record<EventCategory, string> = {
  cultural: "Cultural",
  sports: "Sports",
  academic: "Academic",
  arts: "Arts",
  science: "Science",
  community: "Community",
  celebration: "Celebration",
  competition: "Competition",
  workshop: "Workshop",
  assembly: "Assembly",
};

// The lifecycle stages a school event moves through (the "Event Journey").
export type EventStage = "idea" | "planning" | "approved" | "promotion" | "live" | "completed" | "archived" | "cancelled";

export const eventStageLabels: Record<EventStage, string> = {
  idea: "Idea",
  planning: "Planning",
  approved: "Approved",
  promotion: "Promotion",
  live: "Live",
  completed: "Completed",
  archived: "Archived",
  cancelled: "Cancelled",
};

export const eventStageTone: Record<EventStage, StatusTone> = {
  idea: "neutral",
  planning: "info",
  approved: "info",
  promotion: "warning",
  live: "success",
  completed: "success",
  archived: "neutral",
  cancelled: "error",
};

// The ordered pipeline (excludes terminal cancelled).
export const eventJourneyOrder: EventStage[] = ["idea", "planning", "approved", "promotion", "live", "completed", "archived"];

export type EventAudience = "all-school" | "primary" | "middle" | "senior" | "staff" | "parents" | "invited";

export const eventAudienceLabels: Record<EventAudience, string> = {
  "all-school": "All school",
  primary: "Primary",
  middle: "Middle",
  senior: "Senior",
  staff: "Staff",
  parents: "Parents",
  invited: "Invited only",
};

export type RegistrationMode = "open" | "approval" | "invite-only" | "none";

export const registrationModeLabels: Record<RegistrationMode, string> = {
  open: "Open registration",
  approval: "Requires approval",
  "invite-only": "Invite only",
  none: "No registration",
};

export type SchoolEvent = {
  id: ID;
  title: string;
  code: string;
  category: EventCategory;
  stage: EventStage;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  venue: string;
  audience: EventAudience[];
  organiserName: string;
  organiserRole: string;
  coordinatorIds: ID[]; // teacher ids
  registrationMode: RegistrationMode;
  capacity?: number;
  registeredCount: number;
  attendedCount: number;
  houseLinked: boolean; // whether it contributes to the house system
  featured: boolean;
  bannerTone: StatusTone;
  createdAt: string;
  updatedAt: string;
};

// Event 360 workspace — planning checklist items.
export type EventTaskStatus = "todo" | "in-progress" | "done" | "blocked";

export const eventTaskStatusLabels: Record<EventTaskStatus, string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
  blocked: "Blocked",
};

export const eventTaskStatusTone: Record<EventTaskStatus, StatusTone> = {
  todo: "neutral",
  "in-progress": "info",
  done: "success",
  blocked: "error",
};

export type EventTask = {
  id: ID;
  eventId: ID;
  title: string;
  owner: string;
  dueDate: string;
  status: EventTaskStatus;
  category: "logistics" | "promotion" | "budget" | "safety" | "content" | "volunteers";
};

// Event 360 — mock budget line (decimal-safe not required; indicative planning only).
export type EventBudgetLine = {
  id: ID;
  eventId: ID;
  label: string;
  category: "venue" | "materials" | "refreshments" | "prizes" | "logistics" | "misc";
  estimated: number;
  actual?: number;
};

export type RegistrationStatus = "pending" | "confirmed" | "waitlisted" | "declined" | "withdrawn";

export const registrationStatusLabels: Record<RegistrationStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  waitlisted: "Waitlisted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export const registrationStatusTone: Record<RegistrationStatus, StatusTone> = {
  pending: "warning",
  confirmed: "success",
  waitlisted: "info",
  declined: "error",
  withdrawn: "neutral",
};

export type EventRegistration = {
  id: ID;
  eventId: ID;
  studentId: ID;
  registeredAt: string;
  status: RegistrationStatus;
  role: "participant" | "volunteer" | "performer" | "spectator" | "organiser";
  notes?: string;
};

export type EventAttendance = {
  id: ID;
  eventId: ID;
  studentId: ID;
  present: boolean;
  checkInTime?: string;
  method: "manual" | "roster" | "token";
};

export type ResultPosition = "1st" | "2nd" | "3rd" | "participation" | "special";

export const resultPositionLabels: Record<ResultPosition, string> = {
  "1st": "1st place",
  "2nd": "2nd place",
  "3rd": "3rd place",
  participation: "Participation",
  special: "Special mention",
};

export const resultPositionTone: Record<ResultPosition, StatusTone> = {
  "1st": "success",
  "2nd": "info",
  "3rd": "warning",
  participation: "neutral",
  special: "info",
};

export type EventResult = {
  id: ID;
  eventId: ID;
  studentId?: ID;
  houseId?: ID;
  teamName?: string;
  position: ResultPosition;
  points: number; // house points awarded (manual, not AI-derived)
  citation: string;
  recordedBy: string;
  recordedAt: string;
};

// ---------------------------------------------------------------------------
// Clubs
// ---------------------------------------------------------------------------

export type ClubCategory = "arts" | "science" | "sports" | "literary" | "service" | "technology" | "music" | "environment" | "debate" | "media";

export const clubCategoryLabels: Record<ClubCategory, string> = {
  arts: "Arts",
  science: "Science",
  sports: "Sports",
  literary: "Literary",
  service: "Community service",
  technology: "Technology",
  music: "Music",
  environment: "Environment",
  debate: "Debate",
  media: "Media",
};

export type Club = {
  id: ID;
  name: string;
  code: string;
  category: ClubCategory;
  description: string;
  facultyAdvisor: string;
  advisorId?: ID;
  meetingSchedule: string;
  venue: string;
  memberCount: number;
  capacity: number;
  status: "active" | "recruiting" | "paused" | "archived";
  foundedYear: number;
  bannerTone: StatusTone;
};

export type ClubMemberRole = "president" | "vice-president" | "secretary" | "treasurer" | "member";

export const clubMemberRoleLabels: Record<ClubMemberRole, string> = {
  president: "President",
  "vice-president": "Vice President",
  secretary: "Secretary",
  treasurer: "Treasurer",
  member: "Member",
};

export type ClubMembership = {
  id: ID;
  clubId: ID;
  studentId: ID;
  role: ClubMemberRole;
  joinedAt: string;
  status: "active" | "pending" | "alumni";
};

export type ClubMeeting = {
  id: ID;
  clubId: ID;
  title: string;
  date: string;
  time: string;
  venue: string;
  agenda: string;
  status: "scheduled" | "completed" | "cancelled";
  attendanceMock: number;
  minutes?: string;
};

// ---------------------------------------------------------------------------
// Sports
// ---------------------------------------------------------------------------

export type SportCategory = "team" | "individual" | "racquet" | "athletics" | "aquatics" | "indoor";

export const sportCategoryLabels: Record<SportCategory, string> = {
  team: "Team sport",
  individual: "Individual",
  racquet: "Racquet",
  athletics: "Athletics",
  aquatics: "Aquatics",
  indoor: "Indoor",
};

export type Sport = {
  id: ID;
  name: string;
  category: SportCategory;
  season: "summer" | "winter" | "monsoon" | "all-year";
  coachName: string;
  coachId?: ID;
  venue: string;
  teamCount: number;
  playerCount: number;
  status: "active" | "off-season";
};

export type SportsTeam = {
  id: ID;
  sportId: ID;
  name: string;
  ageGroup: "u12" | "u14" | "u16" | "u19" | "open";
  gender: "boys" | "girls" | "mixed";
  captainId?: ID;
  coachName: string;
  memberCount: number;
  wins: number;
  losses: number;
  draws: number;
  houseId?: ID;
};

export const teamAgeGroupLabels: Record<SportsTeam["ageGroup"], string> = {
  u12: "Under 12",
  u14: "Under 14",
  u16: "Under 16",
  u19: "Under 19",
  open: "Open",
};

export type TeamMember = {
  id: ID;
  teamId: ID;
  studentId: ID;
  position: string;
  jerseyNumber?: number;
  role: "captain" | "vice-captain" | "player" | "reserve";
  status: "selected" | "trial" | "injured" | "reserve";
};

export type FixtureStatus = "scheduled" | "live" | "completed" | "postponed" | "cancelled";

export const fixtureStatusLabels: Record<FixtureStatus, string> = {
  scheduled: "Scheduled",
  live: "Live",
  completed: "Completed",
  postponed: "Postponed",
  cancelled: "Cancelled",
};

export const fixtureStatusTone: Record<FixtureStatus, StatusTone> = {
  scheduled: "info",
  live: "success",
  completed: "neutral",
  postponed: "warning",
  cancelled: "error",
};

export type Fixture = {
  id: ID;
  sportId: ID;
  tournamentId?: ID;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: ID;
  awayTeamId?: ID;
  date: string;
  time: string;
  venue: string;
  status: FixtureStatus;
  homeScore?: number;
  awayScore?: number;
  round?: string;
};

export type Tournament = {
  id: ID;
  name: string;
  sportId: ID;
  format: "knockout" | "league" | "round-robin" | "group-knockout";
  startDate: string;
  endDate: string;
  teamCount: number;
  status: "upcoming" | "ongoing" | "completed";
  championTeam?: string;
  runnerUpTeam?: string;
};

export const tournamentFormatLabels: Record<Tournament["format"], string> = {
  knockout: "Knockout",
  league: "League",
  "round-robin": "Round robin",
  "group-knockout": "Group + knockout",
};

// A single node in a knockout bracket.
export type BracketMatch = {
  id: ID;
  tournamentId: ID;
  round: number; // 1 = first round, higher = later
  roundLabel: string; // "Quarter-final", "Semi-final", "Final"
  slot: number; // position within the round
  teamA?: string;
  teamB?: string;
  scoreA?: number;
  scoreB?: number;
  winner?: string;
  status: FixtureStatus;
};

// ---------------------------------------------------------------------------
// Competitions
// ---------------------------------------------------------------------------

export type Competition = {
  id: ID;
  name: string;
  code: string;
  category: EventCategory;
  description: string;
  date: string;
  venue: string;
  organiserName: string;
  level: "intra-house" | "inter-house" | "inter-class" | "open";
  status: "open" | "judging" | "results-published" | "closed";
  participantCount: number;
  houseLinked: boolean;
  // Configurable scoring criteria (weights) — judges enter scores manually.
  // No AI scoring: the UI only totals what a human judge inputs.
  criteria: CompetitionCriterion[];
};

export const competitionLevelLabels: Record<Competition["level"], string> = {
  "intra-house": "Intra-house",
  "inter-house": "Inter-house",
  "inter-class": "Inter-class",
  open: "Open",
};

export type CompetitionCriterion = {
  id: ID;
  label: string;
  maxScore: number;
  weight: number; // relative weight, out of 100 across criteria
};

export type CompetitionParticipant = {
  id: ID;
  competitionId: ID;
  studentId?: ID;
  teamName?: string;
  houseId?: ID;
  entryNumber: string;
  status: "registered" | "checked-in" | "scored" | "disqualified";
  // Per-criterion scores keyed by criterion id — entered by a human judge.
  scores: Record<string, number>;
  totalScore?: number;
};

// ---------------------------------------------------------------------------
// House system
// ---------------------------------------------------------------------------

export type House = {
  id: ID;
  name: string;
  motto: string;
  color: string; // hex, for the crest/accent
  emblem: string; // emoji / glyph — no external image
  captainName: string;
  captainId?: ID;
  houseMasterName: string;
  memberCount: number;
  totalPoints: number;
  rank: number;
};

export type HousePointReason =
  | "event-result"
  | "competition"
  | "sports"
  | "academic"
  | "attendance"
  | "community-service"
  | "discipline"
  | "special-recognition"
  | "adjustment";

export const housePointReasonLabels: Record<HousePointReason, string> = {
  "event-result": "Event result",
  competition: "Competition",
  sports: "Sports",
  academic: "Academic",
  attendance: "Attendance",
  "community-service": "Community service",
  discipline: "Discipline",
  "special-recognition": "Special recognition",
  adjustment: "Manual adjustment",
};

// Append-only audit-style ledger of house point movements.
export type HousePointEntry = {
  id: ID;
  houseId: ID;
  points: number; // can be negative (deduction)
  reason: HousePointReason;
  description: string;
  sourceId?: ID; // linked event/competition id
  awardedBy: string;
  awardedByRole: string;
  awardedAt: string;
};

// ---------------------------------------------------------------------------
// Achievements, awards & certificates
// ---------------------------------------------------------------------------

export type AchievementLevel = "school" | "district" | "state" | "national" | "international";

export const achievementLevelLabels: Record<AchievementLevel, string> = {
  school: "School",
  district: "District",
  state: "State",
  national: "National",
  international: "International",
};

export const achievementLevelTone: Record<AchievementLevel, StatusTone> = {
  school: "neutral",
  district: "info",
  state: "info",
  national: "success",
  international: "success",
};

export type Achievement = {
  id: ID;
  studentId: ID;
  title: string;
  category: EventCategory;
  level: AchievementLevel;
  date: string;
  description: string;
  position?: ResultPosition;
  verifiedBy?: string;
  sourceEventId?: ID;
};

export type AwardType = "trophy" | "medal" | "certificate" | "shield" | "title" | "scholarship-honour";

export const awardTypeLabels: Record<AwardType, string> = {
  trophy: "Trophy",
  medal: "Medal",
  certificate: "Certificate",
  shield: "Shield",
  title: "Title",
  "scholarship-honour": "Scholarship honour",
};

export type Award = {
  id: ID;
  name: string;
  type: AwardType;
  category: EventCategory;
  recipientType: "student" | "house" | "team" | "club";
  recipientId?: ID;
  recipientName: string;
  citation: string;
  awardedAt: string;
  ceremony: string;
  presentedBy: string;
};

// Certificate template — used by the builder. Rendered print-styled.
export type CertificateTemplate = {
  id: ID;
  name: string;
  purpose: "participation" | "merit" | "achievement" | "appreciation" | "completion";
  orientation: "landscape" | "portrait";
  accentColor: string;
  borderStyle: "classic" | "modern" | "minimal" | "ornate";
  bodyText: string; // supports {name} {event} {date} {position} tokens
  signatoryTitle: string;
  showSeal: boolean;
};

export const certificatePurposeLabels: Record<CertificateTemplate["purpose"], string> = {
  participation: "Participation",
  merit: "Merit",
  achievement: "Achievement",
  appreciation: "Appreciation",
  completion: "Completion",
};

export type Certificate = {
  id: ID;
  templateId: ID;
  serial: string; // opaque mock serial — not a real verification code
  recipientName: string;
  studentId?: ID;
  eventTitle: string;
  position?: ResultPosition;
  issuedDate: string;
  issuedBy: string;
  status: "draft" | "issued" | "revoked";
};

// ---------------------------------------------------------------------------
// Aggregate participation record (feeds the Campus Activity Pulse — operational
// counts only, never a ranking of a student's character or worth).
// ---------------------------------------------------------------------------

export type ActivityParticipationSummary = {
  studentId: ID;
  eventsAttended: number;
  clubsJoined: number;
  sportsTeams: number;
  competitionsEntered: number;
  achievements: number;
};
