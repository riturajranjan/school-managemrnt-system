import type { ID } from "./common";

// ===========================================================================
// Phase 9 — Communication, Notifications, Helpdesk & Front Desk.
// Frontend mock models only (no DB schema, no real messaging integrations).
// ===========================================================================

export type ParticipantRole = "parent" | "student" | "teacher" | "staff" | "principal" | "admin" | "department";

export const participantRoleLabels: Record<ParticipantRole, string> = {
  parent: "Parent",
  student: "Student",
  teacher: "Teacher",
  staff: "Staff",
  principal: "Principal",
  admin: "Admin",
  department: "Department",
};

export type ConversationParticipant = {
  id: ID;
  name: string;
  role: ParticipantRole;
  avatarColor: string;
};

export type ConversationCategory = "academic" | "attendance" | "homework" | "behavior" | "exam" | "transport" | "fee-query" | "general" | "meeting-request";

export const conversationCategoryLabels: Record<ConversationCategory, string> = {
  academic: "Academic",
  attendance: "Attendance",
  homework: "Homework",
  behavior: "Behavior",
  exam: "Exam",
  transport: "Transport",
  "fee-query": "Fee query",
  general: "General",
  "meeting-request": "Meeting request",
};

export type ConversationPriority = "normal" | "priority" | "urgent";
export type ConversationStatus = "open" | "resolved" | "archived";

/** Links a conversation to a student so messaging can surface school context
 * (attendance, homework, fees) without duplicating those modules. */
export type Conversation = {
  id: ID;
  subject: string;
  category: ConversationCategory;
  participantIds: ID[];
  /** The non-"me" primary counterpart, for list display. */
  counterpartId: ID;
  studentId?: ID;
  priority: ConversationPriority;
  status: ConversationStatus;
  unreadCount: number;
  hasAttachment: boolean;
  lastMessagePreview: string;
  lastMessageAt: string;
  nextFollowUpAt?: string;
  createdAt: string;
};

export type MessageDeliveryState = "sending" | "sent" | "delivered" | "read" | "failed";

export type MessageAttachment = { id: ID; name: string; kind: "image" | "pdf" | "doc" | "link" };

export type Message = {
  id: ID;
  conversationId: ID;
  senderId: ID;
  /** True when authored by the current demo user ("me"). */
  fromMe: boolean;
  body: string;
  attachments: MessageAttachment[];
  /** Internal notes are private staff-only annotations, styled distinctly. */
  internal: boolean;
  delivery: MessageDeliveryState;
  sentAt: string;
};

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export type GroupType = "class" | "section" | "subject" | "department" | "staff" | "teachers" | "parents" | "transport-route" | "club" | "sports-team" | "event" | "custom";

export const groupTypeLabels: Record<GroupType, string> = {
  class: "Class",
  section: "Section",
  subject: "Subject",
  department: "Department",
  staff: "Staff",
  teachers: "Teachers",
  parents: "Parents",
  "transport-route": "Transport route",
  club: "Club",
  "sports-team": "Sports team",
  event: "Event",
  custom: "Custom",
};

export type CommunicationGroup = {
  id: ID;
  name: string;
  type: GroupType;
  memberCount: number;
  adminIds: ID[];
  lastMessagePreview: string;
  lastMessageAt: string;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export type AnnouncementCategory = "holiday" | "exam-schedule" | "parent-meeting" | "school-event" | "result-publication" | "fee-reminder" | "transport-change" | "emergency-notice";

export const announcementCategoryLabels: Record<AnnouncementCategory, string> = {
  holiday: "Holiday",
  "exam-schedule": "Exam schedule",
  "parent-meeting": "Parent meeting",
  "school-event": "School event",
  "result-publication": "Result publication",
  "fee-reminder": "Fee reminder",
  "transport-change": "Transport change",
  "emergency-notice": "Emergency notice",
};

export type AnnouncementAudience = "everyone" | "students" | "parents" | "teachers" | "staff" | "class" | "department";
export type AnnouncementPriority = "normal" | "important" | "critical";
export type AnnouncementStatus = "draft" | "scheduled" | "published" | "expired" | "archived";

export const announcementStatusTone: Record<AnnouncementStatus, "success" | "warning" | "info" | "neutral"> = {
  draft: "neutral",
  scheduled: "info",
  published: "success",
  expired: "warning",
  archived: "neutral",
};

export type CommChannel = "in-app" | "push" | "sms" | "whatsapp" | "email";

export const channelLabels: Record<CommChannel, string> = {
  "in-app": "In-app",
  push: "Push",
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
};

/** Which channels are "live" in this frontend build. Only in-app is real;
 * everything else is a designed-but-not-connected demo channel. */
export const LIVE_CHANNELS: CommChannel[] = ["in-app"];

export type Announcement = {
  id: ID;
  title: string;
  body: string;
  category: AnnouncementCategory;
  audience: AnnouncementAudience;
  audienceTarget?: string;
  priority: AnnouncementPriority;
  channels: CommChannel[];
  status: AnnouncementStatus;
  acknowledgementRequired: boolean;
  hasAttachment: boolean;
  publishAt: string;
  expiresAt?: string;
  sentCount: number;
  seenCount: number;
  acknowledgedCount: number;
  createdBy: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Notices (digital notice board)
// ---------------------------------------------------------------------------

export type NoticeCategory = "academic" | "administrative" | "events" | "examination" | "holiday" | "sports" | "cultural" | "transport" | "general";

export const noticeCategoryLabels: Record<NoticeCategory, string> = {
  academic: "Academic",
  administrative: "Administrative",
  events: "Events",
  examination: "Examination",
  holiday: "Holiday",
  sports: "Sports",
  cultural: "Cultural",
  transport: "Transport",
  general: "General",
};

export type Notice = {
  id: ID;
  title: string;
  body: string;
  category: NoticeCategory;
  colorTone: "info" | "success" | "warning" | "neutral" | "error";
  status: AnnouncementStatus;
  acknowledgementRequired: boolean;
  publishAt: string;
  expiresAt?: string;
  sentCount: number;
  seenCount: number;
  acknowledgedCount: number;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Broadcasts & scheduled communications
// ---------------------------------------------------------------------------

export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

export type Broadcast = {
  id: ID;
  title: string;
  message: string;
  audience: AnnouncementAudience;
  audienceTarget?: string;
  channels: CommChannel[];
  status: BroadcastStatus;
  estimatedRecipients: number;
  deliveredCount: number;
  failedCount: number;
  scheduledAt?: string;
  sentAt?: string;
  createdBy: string;
  createdAt: string;
};

export type ScheduledCommunication = {
  id: ID;
  kind: "announcement" | "broadcast" | "meeting" | "follow-up" | "reminder" | "event";
  title: string;
  date: string;
  time?: string;
  linkedId?: ID;
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type TemplateCategory = "attendance" | "fees" | "exams" | "results" | "homework" | "transport" | "events" | "birthday" | "emergency" | "leave" | "library" | "hr" | "custom";

export const templateCategoryLabels: Record<TemplateCategory, string> = {
  attendance: "Attendance",
  fees: "Fees",
  exams: "Exams",
  results: "Results",
  homework: "Homework",
  transport: "Transport",
  events: "Events",
  birthday: "Birthday",
  emergency: "Emergency",
  leave: "Leave",
  library: "Library",
  hr: "HR",
  custom: "Custom",
};

export type CommunicationTemplate = {
  id: ID;
  name: string;
  category: TemplateCategory;
  subject: string;
  bodyEn: string;
  bodyHi: string;
  variables: string[];
  channels: CommChannel[];
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationModule = "academic" | "attendance" | "exams" | "fees" | "transport" | "library" | "hr" | "communication" | "system";

export const notificationModuleLabels: Record<NotificationModule, string> = {
  academic: "Academic",
  attendance: "Attendance",
  exams: "Exams",
  fees: "Fees",
  transport: "Transport",
  library: "Library",
  hr: "HR",
  communication: "Communication",
  system: "System",
};

export type CommNotification = {
  id: ID;
  module: NotificationModule;
  title: string;
  description: string;
  priority: "normal" | "high" | "urgent";
  read: boolean;
  archived: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  createdAt: string;
};

export type NotificationPreference = {
  module: NotificationModule;
  channels: Record<CommChannel, boolean>;
};

export type NotificationSettings = {
  preferences: NotificationPreference[];
  quietHoursStart: string;
  quietHoursEnd: string;
  language: "en" | "hi";
  digest: "off" | "daily" | "weekly";
  emergencyOverride: boolean;
};

// ---------------------------------------------------------------------------
// Helpdesk
// ---------------------------------------------------------------------------

export type TicketCategory = "academic" | "fees" | "transport" | "it" | "library" | "facilities" | "hr" | "administration" | "parent-support" | "student-support";

export const ticketCategoryLabels: Record<TicketCategory, string> = {
  academic: "Academic",
  fees: "Fees",
  transport: "Transport",
  it: "IT",
  library: "Library",
  facilities: "Facilities",
  hr: "HR",
  administration: "Administration",
  "parent-support": "Parent support",
  "student-support": "Student support",
};

export type TicketPriority = "low" | "normal" | "high" | "urgent";

export const ticketPriorityTone: Record<TicketPriority, "neutral" | "info" | "warning" | "error"> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "error",
};

export type TicketStatus = "new" | "open" | "in-progress" | "waiting-on-requester" | "escalated" | "resolved" | "closed";

export const ticketStatusLabels: Record<TicketStatus, string> = {
  new: "New",
  open: "Open",
  "in-progress": "In progress",
  "waiting-on-requester": "Waiting on requester",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

export const ticketStatusTone: Record<TicketStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  new: "info",
  open: "info",
  "in-progress": "warning",
  "waiting-on-requester": "neutral",
  escalated: "error",
  resolved: "success",
  closed: "neutral",
};

export type HelpdeskTicket = {
  id: ID;
  reference: string;
  subject: string;
  requesterName: string;
  requesterRole: ParticipantRole;
  studentId?: ID;
  category: TicketCategory;
  assignedTeam: string;
  assignedTo?: string;
  priority: TicketPriority;
  status: TicketStatus;
  slaHours: number;
  createdAt: string;
  lastActivityAt: string;
};

export type TicketReply = {
  id: ID;
  ticketId: ID;
  authorName: string;
  fromStaff: boolean;
  internal: boolean;
  body: string;
  createdAt: string;
};

export type KnowledgeArticle = {
  id: ID;
  title: string;
  category: "admissions" | "fees" | "attendance" | "exams" | "transport" | "library" | "parent-portal" | "student-portal" | "staff-portal";
  excerpt: string;
  views: number;
  helpfulPercent: number;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Front Desk — visitors, appointments, gate passes, calls, deliveries
// ---------------------------------------------------------------------------

export type VisitorType = "parent" | "vendor" | "guest" | "contractor" | "interview-candidate" | "alumni" | "official" | "other";

export const visitorTypeLabels: Record<VisitorType, string> = {
  parent: "Parent",
  vendor: "Vendor",
  guest: "Guest",
  contractor: "Contractor",
  "interview-candidate": "Interview candidate",
  alumni: "Alumni",
  official: "Official",
  other: "Other",
};

export type VisitorStatus = "expected" | "waiting" | "checked-in" | "meeting" | "checked-out" | "denied" | "cancelled";

export const visitorStatusLabels: Record<VisitorStatus, string> = {
  expected: "Expected",
  waiting: "Waiting",
  "checked-in": "Checked in",
  meeting: "In meeting",
  "checked-out": "Checked out",
  denied: "Denied",
  cancelled: "Cancelled",
};

export const visitorStatusTone: Record<VisitorStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  expected: "info",
  waiting: "warning",
  "checked-in": "success",
  meeting: "info",
  "checked-out": "neutral",
  denied: "error",
  cancelled: "neutral",
};

export type Visitor = {
  id: ID;
  visitorNumber: string;
  name: string;
  phone: string;
  organization?: string;
  purpose: string;
  hostName: string;
  department: string;
  type: VisitorType;
  date: string;
  arrivalTime?: string;
  departureTime?: string;
  vehicleNumber?: string;
  badgeCode: string;
  status: VisitorStatus;
  createdAt: string;
};

export type AppointmentType = "parent-meeting" | "principal-meeting" | "teacher-meeting" | "admission-enquiry" | "vendor-meeting" | "interview" | "counselling" | "general";

export const appointmentTypeLabels: Record<AppointmentType, string> = {
  "parent-meeting": "Parent meeting",
  "principal-meeting": "Principal meeting",
  "teacher-meeting": "Teacher meeting",
  "admission-enquiry": "Admission enquiry",
  "vendor-meeting": "Vendor meeting",
  interview: "Interview",
  counselling: "Counselling",
  general: "General",
};

export type AppointmentStatus = "scheduled" | "confirmed" | "in-progress" | "completed" | "cancelled" | "no-show";

export type VisitorAppointment = {
  id: ID;
  visitorName: string;
  hostName: string;
  type: AppointmentType;
  purpose: string;
  date: string;
  time: string;
  durationMinutes: number;
  location: string;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
};

export type GatePassType = "student" | "staff" | "visitor" | "material" | "vehicle";

export const gatePassTypeLabels: Record<GatePassType, string> = {
  student: "Student gate pass",
  staff: "Staff gate pass",
  visitor: "Visitor gate pass",
  material: "Material gate pass",
  vehicle: "Vehicle gate pass",
};

export type GatePassStatus = "requested" | "approved" | "active" | "returned" | "rejected" | "expired";

export const gatePassStatusLabels: Record<GatePassStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  active: "Active",
  returned: "Returned",
  rejected: "Rejected",
  expired: "Expired",
};

export const gatePassStatusTone: Record<GatePassStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  requested: "warning",
  approved: "info",
  active: "success",
  returned: "neutral",
  rejected: "error",
  expired: "neutral",
};

export type GatePass = {
  id: ID;
  reference: string;
  type: GatePassType;
  subjectName: string;
  classOrDept?: string;
  reason: string;
  requestedBy: string;
  authorizedBy?: string;
  guardianName?: string;
  exitTime?: string;
  expectedReturn?: string;
  status: GatePassStatus;
  createdAt: string;
};

export type CallType = "parent" | "admission-enquiry" | "vendor" | "staff" | "emergency" | "general";

export const callTypeLabels: Record<CallType, string> = {
  parent: "Parent",
  "admission-enquiry": "Admission enquiry",
  vendor: "Vendor",
  staff: "Staff",
  emergency: "Emergency",
  general: "General",
};

export type ReceptionCall = {
  id: ID;
  callerName: string;
  phone: string;
  type: CallType;
  relatedTo?: string;
  department: string;
  subject: string;
  receivedBy: string;
  time: string;
  outcome: "resolved" | "transferred" | "callback-needed" | "message-taken";
  followUpNeeded: boolean;
  notes?: string;
};

export type DeliveryStatus = "received" | "awaiting-collection" | "collected" | "returned";

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  received: "Received",
  "awaiting-collection": "Awaiting collection",
  collected: "Collected",
  returned: "Returned",
};

export type Delivery = {
  id: ID;
  courier: string;
  sender: string;
  recipient: string;
  department: string;
  packageCount: number;
  arrivalTime: string;
  receivedBy: string;
  collectedAt?: string;
  status: DeliveryStatus;
};

export type FrontDeskIncident = {
  id: ID;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  reportedBy: string;
  status: "open" | "resolved";
  createdAt: string;
};
