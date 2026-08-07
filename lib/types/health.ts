import type { ID } from "./common";

// ===========================================================================
// Phase 10 — Health / Infirmary & Counselling. Administrative record-keeping
// UI only. NOT diagnosis software. All records are explicit mock data — the UI
// never infers, diagnoses, scores or predicts any health/mental condition.
// ===========================================================================

/** Extended, explicit health record. The base allergies/conditions live on the
 * Student model; this adds infirmary-facing administrative fields. All fields
 * are recorded facts, never inferred. */
export type HealthProfile = {
  studentId: ID;
  bloodGroup?: string;
  allergies: string[];
  careInstructions?: string;
  physicianName?: string;
  physicianPhone?: string;
  insuranceProvider?: string;
  insuranceNumberMasked?: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  lastUpdated: string;
  /** Immunisation records as recorded by the school, never medical advice. */
  immunisations: { name: string; date: string; status: "recorded" | "due" }[];
};

export type VisitStatus = "waiting" | "being-seen" | "resting" | "returning-to-class" | "guardian-pickup" | "referred" | "completed";

export const visitStatusLabels: Record<VisitStatus, string> = {
  waiting: "Waiting",
  "being-seen": "Being seen",
  resting: "Resting",
  "returning-to-class": "Returning to class",
  "guardian-pickup": "Guardian pickup",
  referred: "Referred externally",
  completed: "Completed",
};

export const visitStatusTone: Record<VisitStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  waiting: "warning",
  "being-seen": "info",
  resting: "warning",
  "returning-to-class": "success",
  "guardian-pickup": "info",
  referred: "error",
  completed: "neutral",
};

export type HealthVisit = {
  id: ID;
  studentId: ID;
  arrivalAt: string;
  reason: string;
  symptomsReported?: string;
  observationNotes?: string;
  careAction?: string;
  restStart?: string;
  restEnd?: string;
  guardianContacted: boolean;
  referredExternally: boolean;
  followUpDate?: string;
  staffName: string;
  status: VisitStatus;
  notes?: string;
};

export type IncidentType = "injury" | "illness-reported" | "sports-incident" | "playground-incident" | "classroom-incident" | "transport-health-incident" | "other";

export const incidentTypeLabels: Record<IncidentType, string> = {
  injury: "Injury",
  "illness-reported": "Illness reported",
  "sports-incident": "Sports incident",
  "playground-incident": "Playground incident",
  "classroom-incident": "Classroom incident",
  "transport-health-incident": "Transport-related",
  other: "Other",
};

export type IncidentStatus = "open" | "monitoring" | "guardian-contacted" | "referred" | "resolved" | "closed";

export const incidentStatusTone: Record<IncidentStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  open: "error",
  monitoring: "warning",
  "guardian-contacted": "info",
  referred: "warning",
  resolved: "success",
  closed: "neutral",
};

export type HealthIncident = {
  id: ID;
  reference: string;
  studentId: ID;
  type: IncidentType;
  occurredAt: string;
  location: string;
  reportedBy: string;
  description: string;
  immediateAction: string;
  guardianContacted: boolean;
  externalReferral: boolean;
  followUpDate?: string;
  status: IncidentStatus;
};

export type MedicationStatus = "scheduled" | "due" | "recorded" | "missed" | "held";

export const medicationStatusLabels: Record<MedicationStatus, string> = {
  scheduled: "Scheduled",
  due: "Due",
  recorded: "Recorded",
  missed: "Missed",
  held: "Held",
};

export const medicationStatusTone: Record<MedicationStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  scheduled: "info",
  due: "warning",
  recorded: "success",
  missed: "error",
  held: "neutral",
};

/** School-authorised medication record-keeping only. `medicationName`, `dose`
 * and `instructions` are exactly as recorded/authorised — the UI never
 * generates or recommends dosage. */
export type MedicationRecord = {
  id: ID;
  studentId: ID;
  medicationName: string;
  guardianAuthorised: boolean;
  scheduleLabel: string;
  scheduledTime: string;
  doseAsRecorded: string;
  instructionsAsRecorded: string;
  status: MedicationStatus;
  administeredAt?: string;
  staffName?: string;
  notes?: string;
  date: string;
};

export type HealthAppointmentStatus = "requested" | "scheduled" | "completed" | "cancelled" | "follow-up";

export type HealthAppointment = {
  id: ID;
  studentId: ID;
  purpose: string;
  date: string;
  time: string;
  staffName: string;
  status: HealthAppointmentStatus;
};

// ---------------------------------------------------------------------------
// Counselling — administrative only. Never a diagnosis/scoring tool.
// ---------------------------------------------------------------------------

export type CounsellingAppointmentType = "self-referral" | "teacher-referral" | "parent-referral" | "routine-checkin" | "career-guidance" | "academic-support";

export const counsellingAppointmentTypeLabels: Record<CounsellingAppointmentType, string> = {
  "self-referral": "Self referral",
  "teacher-referral": "Teacher referral",
  "parent-referral": "Parent referral",
  "routine-checkin": "Routine check-in",
  "career-guidance": "Career guidance",
  "academic-support": "Academic support",
};

export type CounsellingStatus = "requested" | "scheduled" | "completed" | "rescheduled" | "cancelled" | "follow-up";

export const counsellingStatusLabels: Record<CounsellingStatus, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  completed: "Completed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  "follow-up": "Follow-up",
};

export const counsellingStatusTone: Record<CounsellingStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  requested: "warning",
  scheduled: "info",
  completed: "success",
  rescheduled: "warning",
  cancelled: "neutral",
  "follow-up": "info",
};

export type CounsellingAppointment = {
  id: ID;
  studentId: ID;
  counsellorName: string;
  date: string;
  time: string;
  type: CounsellingAppointmentType;
  /** A broad administrative category only — never diagnostic content. */
  adminReasonCategory: string;
  status: CounsellingStatus;
  /** Private notes are gated behind counselling.private and never shown in
   * general views. Placeholder text only in this frontend build. */
  privateNotePlaceholder?: string;
  followUpDate?: string;
};

export type CounsellingResource = {
  id: ID;
  title: string;
  category: "study-habits" | "exam-preparation" | "time-management" | "school-adjustment" | "communication-skills" | "career-exploration" | "anti-bullying" | "digital-safety" | "general-wellbeing";
  description: string;
  format: "article" | "video" | "worksheet" | "link";
  updatedAt: string;
};

export const counsellingResourceCategoryLabels: Record<CounsellingResource["category"], string> = {
  "study-habits": "Study habits",
  "exam-preparation": "Exam preparation",
  "time-management": "Time management",
  "school-adjustment": "School adjustment",
  "communication-skills": "Communication skills",
  "career-exploration": "Career exploration",
  "anti-bullying": "Anti-bullying",
  "digital-safety": "Digital safety",
  "general-wellbeing": "General wellbeing",
};
