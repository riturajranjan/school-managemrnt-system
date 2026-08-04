export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

export type PriorityLevel = "high" | "medium" | "low";

export type AiInsightCategory = "staff" | "attendance" | "fees" | "transport" | "admissions" | "academics";

export type AiInsight = {
  id: string;
  /** The operational headline, e.g. "3 teachers are absent". */
  title: string;
  category: AiInsightCategory;
  priority: PriorityLevel;
  /** e.g. "As of 8:00 AM" or "Since yesterday" — when this became true, not when it was generated. */
  timeContext: string;
  recommendedAction: string;
  /** Why this was surfaced — the reasoning behind the insight, shown via "Explain insight". */
  explanation: string;
};

export type AiBriefData = {
  generatedAt: string;
  insights: AiInsight[];
};

export type PulseFactorKey =
  | "attendance"
  | "fees"
  | "academics"
  | "staff"
  | "parentEngagement"
  | "transport"
  | "approvals"
  | "issues";

export type PulseFactor = {
  key: PulseFactorKey;
  label: string;
  /** Normalized 0-100 so every factor can share one ring/bar scale regardless of its native unit. */
  score: number;
  /** Human-readable native value, e.g. "94%" or "5 pending". */
  displayValue: string;
  tone: StatusTone;
};

export type PulseStatus = "Excellent" | "Good" | "Needs Attention" | "Critical";

export type SchoolPulseData = {
  score: number;
  status: PulseStatus;
  weeklyChangePts: number;
  positiveFactor: { label: string; detail: string };
  riskFactor: { label: string; detail: string };
  recommendedAction: string;
  factors: PulseFactor[];
};

export type CampusZoneStatus = "normal" | "busy" | "alert";

export type CampusZone = {
  id: string;
  name: string;
  occupancyPercent: number;
  status: CampusZoneStatus;
  /** Grid position within the isometric layout, 0-indexed. */
  col: number;
  row: number;
  /** Relative extrusion height for the 3D preview, in px. */
  height: number;
};

export type CampusOverviewData = {
  occupancyPercent: number;
  activeZones: number;
  totalZones: number;
  zones: CampusZone[];
};

export type ActionInboxItem = {
  id: string;
  title: string;
  description: string;
  category: ActionCategory;
  priority: PriorityLevel;
  dueLabel: string;
  requestedBy: string;
};

export type ActionInboxData = {
  items: ActionInboxItem[];
};

export type AttendanceGradeRow = {
  grade: string;
  percent: number;
};

export type AttendanceData = {
  overallPercent: number;
  /** Yesterday's overall percent, for the day-over-day comparison. */
  yesterdayPercent: number;
  present: number;
  absent: number;
  late: number;
  totalStudents: number;
  byGrade: AttendanceGradeRow[];
};

export type FeePayment = {
  id: string;
  studentName: string;
  grade: string;
  amount: number;
  method: "UPI" | "Card" | "Cash" | "Bank Transfer";
  time: string;
};

export type FeeCollectionData = {
  collectedPercent: number;
  collectedAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  targetAmount: number;
  overdueInvoices: number;
  trend: number[];
  recentPayments: FeePayment[];
};

export type StaffStatus = "in" | "absent" | "leave" | "late";

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  status: StaffStatus;
  initials: string;
};

export type SubstituteRequirementStatus = "unfilled" | "assigned";

export type SubstituteRequirement = {
  id: string;
  className: string;
  subject: string;
  coveringFor: string;
  status: SubstituteRequirementStatus;
  substituteName?: string;
};

export type StaffAvailabilityData = {
  totalStaff: number;
  present: number;
  absent: number;
  onLeave: number;
  late: number;
  staff: StaffMember[];
  substituteRequirements: SubstituteRequirement[];
};

export type TransportRouteStatus = "on-time" | "delayed" | "issue" | "completed";

export type TransportRoute = {
  id: string;
  name: string;
  status: TransportRouteStatus;
  etaMinutes: number;
  studentsOnboard: number;
};

export type MaintenanceAlert = {
  id: string;
  busId: string;
  issue: string;
  reportedAgo: string;
};

export type TransportStatusData = {
  routes: TransportRoute[];
  maintenanceAlerts: MaintenanceAlert[];
};

export type ExceptionSeverity = "critical" | "warning" | "info";

export type ExceptionCategory =
  | "attendance"
  | "fees"
  | "documents"
  | "timetable"
  | "transport"
  | "inventory"
  | "results";

export type ExceptionItem = {
  id: string;
  title: string;
  description: string;
  severity: ExceptionSeverity;
  category: ExceptionCategory;
  time: string;
  source: string;
};

export type ExceptionFeedData = {
  items: ExceptionItem[];
};

export type TimetableSlotStatus = "completed" | "current" | "upcoming";

export type TimetableSlot = {
  id: string;
  time: string;
  subject: string;
  teacher: string;
  room: string;
  status: TimetableSlotStatus;
  /** Conflict description, e.g. a double-booked room — omitted when there's no conflict. */
  conflict?: string;
};

export type TodaysTimetableData = {
  slots: TimetableSlot[];
};

export type EventCategory = "exam" | "holiday" | "meeting" | "celebration" | "ptm" | "deadline";

export type EventItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  category: EventCategory;
};

export type UpcomingEventsData = {
  events: EventItem[];
};

export type ActionCategory =
  | "leave"
  | "admission"
  | "fee-concession"
  | "certificate"
  | "result-publication"
  | "purchase";
