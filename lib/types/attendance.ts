import type { ID, StatusTone } from "./common";

export type AttendanceMode = "daily" | "period" | "subject" | "half-day" | "event" | "transport" | "hostel";

export type AttendanceStatus = "present" | "absent" | "late" | "excused" | "half-day" | "medical-leave" | "official-duty" | "not-marked";

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
  "half-day": "Half day",
  "medical-leave": "Medical leave",
  "official-duty": "Official duty",
  "not-marked": "Not marked",
};

export const attendanceStatusTone: Record<AttendanceStatus, StatusTone> = {
  present: "success",
  absent: "error",
  late: "warning",
  excused: "info",
  "half-day": "warning",
  "medical-leave": "info",
  "official-duty": "info",
  "not-marked": "neutral",
};

export type AttendanceRecord = {
  studentId: ID;
  status: AttendanceStatus;
  note?: string;
  lateMinutes?: number;
  earlyDepartureMinutes?: number;
};

export type AttendanceSession = {
  id: ID;
  classId: ID;
  sectionId: ID;
  date: string;
  period?: number;
  mode: AttendanceMode;
  subjectId?: ID;
  markedBy: string;
  markedAt: string;
  locked: boolean;
  notifiedParents: boolean;
  records: AttendanceRecord[];
};

export type LeaveApplicantType = "student" | "staff";

export type LeaveType = "sick" | "medical" | "casual" | "emergency" | "family-event" | "official-duty" | "other";

export const leaveTypeLabels: Record<LeaveType, string> = {
  sick: "Sick leave",
  medical: "Medical leave",
  casual: "Casual leave",
  emergency: "Emergency leave",
  "family-event": "Family event",
  "official-duty": "Official duty",
  other: "Other",
};

export type LeaveStatus = "draft" | "submitted" | "under-review" | "approved" | "rejected" | "cancelled";

export const leaveStatusTone: Record<LeaveStatus, StatusTone> = {
  draft: "neutral",
  submitted: "info",
  "under-review": "warning",
  approved: "success",
  rejected: "error",
  cancelled: "neutral",
};

export type LeaveRequest = {
  id: ID;
  applicantType: LeaveApplicantType;
  applicantId: ID;
  applicantName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  reason: string;
  attachmentName?: string;
  emergencyContact?: string;
  submittedAt: string;
  status: LeaveStatus;
  reviewerName?: string;
  reviewerNote?: string;
};

// Staff attendance/leave mock types were removed in Phase 9E — real
// StaffAttendanceRecord + LeaveRequest (lib/api/contracts.ts) back
// app/attendance/staff and app/attendance/leave now. LeaveRequest below
// remains — the mock leave store still backs app/academics/page.tsx's
// substitute-requirement selector (not migrated in Phase 9E).
