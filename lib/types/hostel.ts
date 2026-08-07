import type { ID } from "./common";

// ===========================================================================
// Phase 10 — Hostel Management. Frontend mock models only (no DB schema).
// ===========================================================================

export type HostelType = "boys" | "girls" | "junior" | "senior" | "staff" | "international" | "custom";

export const hostelTypeLabels: Record<HostelType, string> = {
  boys: "Boys",
  girls: "Girls",
  junior: "Junior",
  senior: "Senior",
  staff: "Staff",
  international: "International",
  custom: "Custom",
};

export type BuildingStatus = "active" | "full" | "partial" | "maintenance" | "inactive";

export const buildingStatusTone: Record<BuildingStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  active: "success",
  full: "info",
  partial: "warning",
  maintenance: "warning",
  inactive: "neutral",
};

export type HostelBuilding = {
  id: ID;
  name: string;
  code: string;
  type: HostelType;
  floors: number;
  wardenName: string;
  assistantWardenName?: string;
  status: BuildingStatus;
  branch: string;
  createdAt: string;
};

export type HostelFloor = {
  id: ID;
  buildingId: ID;
  number: number;
  name: string;
};

export type RoomType = "single" | "double" | "triple" | "four-bed" | "dormitory" | "custom";

export const roomTypeLabels: Record<RoomType, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  "four-bed": "Four-bed",
  dormitory: "Dormitory",
  custom: "Custom",
};

export type RoomStatus = "available" | "partial" | "full" | "maintenance" | "reserved" | "closed";

export const roomStatusLabels: Record<RoomStatus, string> = {
  available: "Available",
  partial: "Partial",
  full: "Full",
  maintenance: "Maintenance",
  reserved: "Reserved",
  closed: "Closed",
};

export const roomStatusTone: Record<RoomStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  available: "success",
  partial: "warning",
  full: "info",
  maintenance: "warning",
  reserved: "info",
  closed: "neutral",
};

export type HostelRoom = {
  id: ID;
  buildingId: ID;
  floorId: ID;
  roomNumber: string;
  type: RoomType;
  capacity: number;
  facilities: string[];
  wardenNotes?: string;
  status: RoomStatus;
};

export type BedStatus = "available" | "occupied" | "reserved" | "blocked" | "maintenance";

export const bedStatusLabels: Record<BedStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  blocked: "Blocked",
  maintenance: "Maintenance",
};

export const bedStatusTone: Record<BedStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  available: "success",
  occupied: "info",
  reserved: "warning",
  blocked: "neutral",
  maintenance: "warning",
};

export type HostelBed = {
  id: ID;
  roomId: ID;
  position: string;
  studentId?: ID;
  allocationDate?: string;
  expectedEnd?: string;
  status: BedStatus;
};

export type AllocationStatus = "active" | "ended" | "transferred";

export type HostelAllocation = {
  id: ID;
  studentId: ID;
  buildingId: ID;
  roomId: ID;
  bedId: ID;
  allocatedAt: string;
  expectedEnd?: string;
  status: AllocationStatus;
};

export type HostelAttendanceStatus = "present" | "on-leave" | "late-return" | "not-checked-in" | "infirmary" | "official-activity";

export const hostelAttendanceStatusLabels: Record<HostelAttendanceStatus, string> = {
  present: "Present",
  "on-leave": "On leave",
  "late-return": "Late return",
  "not-checked-in": "Not checked in",
  infirmary: "Infirmary",
  "official-activity": "Official activity",
};

export const hostelAttendanceStatusTone: Record<HostelAttendanceStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  present: "success",
  "on-leave": "info",
  "late-return": "warning",
  "not-checked-in": "error",
  infirmary: "warning",
  "official-activity": "info",
};

export type HostelAttendance = {
  id: ID;
  studentId: ID;
  date: string;
  status: HostelAttendanceStatus;
  checkInTime?: string;
  note?: string;
};

export type HostelLeaveType = "home" | "medical" | "weekend" | "emergency" | "day-out" | "other";

export const hostelLeaveTypeLabels: Record<HostelLeaveType, string> = {
  home: "Home visit",
  medical: "Medical",
  weekend: "Weekend",
  emergency: "Emergency",
  "day-out": "Day out",
  other: "Other",
};

export type HostelLeaveStatus = "draft" | "requested" | "parent-confirmed" | "approved" | "rejected" | "active" | "returned" | "overdue";

export const hostelLeaveStatusLabels: Record<HostelLeaveStatus, string> = {
  draft: "Draft",
  requested: "Requested",
  "parent-confirmed": "Parent confirmed",
  approved: "Approved",
  rejected: "Rejected",
  active: "Active",
  returned: "Returned",
  overdue: "Overdue return",
};

export const hostelLeaveStatusTone: Record<HostelLeaveStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  draft: "neutral",
  requested: "warning",
  "parent-confirmed": "info",
  approved: "success",
  rejected: "error",
  active: "info",
  returned: "neutral",
  overdue: "error",
};

export type HostelLeave = {
  id: ID;
  studentId: ID;
  type: HostelLeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  destination: string;
  guardianName: string;
  pickupPerson: string;
  expectedReturn: string;
  status: HostelLeaveStatus;
  createdAt: string;
};

export type HostelVisitorStatus = "expected" | "waiting" | "approved" | "with-student" | "departed" | "denied";

export const hostelVisitorStatusLabels: Record<HostelVisitorStatus, string> = {
  expected: "Expected",
  waiting: "Waiting",
  approved: "Approved",
  "with-student": "With student",
  departed: "Departed",
  denied: "Denied",
};

export type HostelVisitor = {
  id: ID;
  studentId: ID;
  visitorName: string;
  relation: string;
  arrivalTime?: string;
  departureTime?: string;
  purpose: string;
  approvedBy?: string;
  status: HostelVisitorStatus;
  date: string;
};

export type ComplaintCategory = "electricity" | "water" | "furniture" | "cleaning" | "bathroom" | "wifi" | "roommate" | "safety" | "mess" | "other";

export const complaintCategoryLabels: Record<ComplaintCategory, string> = {
  electricity: "Electricity",
  water: "Water",
  furniture: "Furniture",
  cleaning: "Cleaning",
  bathroom: "Bathroom",
  wifi: "Wi-Fi",
  roommate: "Roommate issue",
  safety: "Safety",
  mess: "Mess",
  other: "Other",
};

export type ComplaintStatus = "new" | "assigned" | "in-progress" | "resolved" | "closed";

export const complaintStatusTone: Record<ComplaintStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  new: "info",
  assigned: "warning",
  "in-progress": "warning",
  resolved: "success",
  closed: "neutral",
};

export type HostelComplaint = {
  id: ID;
  reference: string;
  studentId: ID;
  roomId: ID;
  category: ComplaintCategory;
  description: string;
  priority: "low" | "normal" | "high" | "urgent";
  assignedTeam: string;
  status: ComplaintStatus;
  createdAt: string;
  lastUpdate: string;
};

export type MaintenanceStatus = "new" | "assigned" | "in-progress" | "resolved" | "closed";

export const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  new: "New",
  assigned: "Assigned",
  "in-progress": "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const maintenanceStatusTone: Record<MaintenanceStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  new: "info",
  assigned: "warning",
  "in-progress": "warning",
  resolved: "success",
  closed: "neutral",
};

export type HostelMaintenance = {
  id: ID;
  roomId: ID;
  issue: string;
  category: ComplaintCategory;
  priority: "low" | "normal" | "high" | "urgent";
  assignedTo?: string;
  createdAt: string;
  eta?: string;
  status: MaintenanceStatus;
};

export type MessMeal = { name: string; items: string[] };

export type HostelMess = {
  id: ID;
  date: string;
  breakfast: MessMeal;
  lunch: MessMeal;
  snacks: MessMeal;
  dinner: MessMeal;
  specialMenu?: string;
  expectedStudents: number;
  attendanceMock: number;
};
