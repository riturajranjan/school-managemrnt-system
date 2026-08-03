export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

export type PriorityLevel = "high" | "medium" | "low";

export type AiBriefData = {
  greetingName: string;
  summary: string;
  generatedAt: string;
  priorities: {
    id: string;
    label: string;
    tone: StatusTone;
  }[];
};

export type PulseMetric = {
  key: string;
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
  tone: StatusTone;
};

export type SchoolPulseData = {
  metrics: PulseMetric[];
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
  category: string;
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
  present: number;
  absent: number;
  late: number;
  totalStudents: number;
  byGrade: AttendanceGradeRow[];
};

export type FeeCollectionData = {
  collectedPercent: number;
  collectedAmount: number;
  targetAmount: number;
  overdueInvoices: number;
  trend: number[];
};

export type StaffStatus = "in" | "out" | "leave" | "late";

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  status: StaffStatus;
  initials: string;
};

export type StaffAvailabilityData = {
  totalStaff: number;
  present: number;
  onLeave: number;
  late: number;
  staff: StaffMember[];
};

export type TransportRouteStatus = "on-time" | "delayed" | "issue";

export type TransportRoute = {
  id: string;
  name: string;
  status: TransportRouteStatus;
  etaMinutes: number;
  studentsOnboard: number;
};

export type TransportStatusData = {
  routes: TransportRoute[];
};

export type ExceptionSeverity = "critical" | "warning" | "info";

export type ExceptionItem = {
  id: string;
  title: string;
  description: string;
  severity: ExceptionSeverity;
  time: string;
  source: string;
};

export type ExceptionFeedData = {
  items: ExceptionItem[];
};

export type TimetableSlot = {
  id: string;
  time: string;
  subject: string;
  teacher: string;
  room: string;
  isNow: boolean;
};

export type TodaysTimetableData = {
  slots: TimetableSlot[];
};

export type EventCategory = "academic" | "sports" | "cultural" | "meeting";

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
