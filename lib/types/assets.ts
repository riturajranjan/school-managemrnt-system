import type { ID } from "./common";
import type { Money } from "@/lib/finance/money";

// ---------------------------------------------------------------------------
// Asset categories & register
// ---------------------------------------------------------------------------

export type AssetCategory = {
  id: ID;
  name: string;
  parentId?: ID;
  defaultUsefulLifeYears: number;
  defaultDepreciationMethod: DepreciationMethod;
  createdAt: string;
};

export type AssetType =
  | "laptop"
  | "desktop"
  | "projector"
  | "smartboard"
  | "printer"
  | "furniture"
  | "lab-equipment"
  | "sports-equipment"
  | "cctv"
  | "network-equipment"
  | "generator"
  | "air-conditioner"
  | "vehicle-equipment"
  | "custom";

export const assetTypeLabels: Record<AssetType, string> = {
  laptop: "Laptop",
  desktop: "Desktop",
  projector: "Projector",
  smartboard: "Smart board",
  printer: "Printer",
  furniture: "Furniture",
  "lab-equipment": "Laboratory equipment",
  "sports-equipment": "Sports equipment",
  cctv: "CCTV",
  "network-equipment": "Network equipment",
  generator: "Generator",
  "air-conditioner": "Air conditioner",
  "vehicle-equipment": "Vehicle equipment",
  custom: "Custom asset",
};

export type AssetStatus = "available" | "assigned" | "in-use" | "maintenance" | "damaged" | "lost" | "retired" | "disposed";

export const assetStatusLabels: Record<AssetStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  "in-use": "In use",
  maintenance: "Under maintenance",
  damaged: "Damaged",
  lost: "Lost",
  retired: "Retired",
  disposed: "Disposed",
};

export type DepreciationMethod = "straight-line" | "declining-balance" | "none";

export const depreciationMethodLabels: Record<DepreciationMethod, string> = {
  "straight-line": "Straight line",
  "declining-balance": "Declining balance",
  none: "No depreciation",
};

export type AssetCondition = "excellent" | "good" | "fair" | "poor" | "unusable";

export const assetConditionLabels: Record<AssetCondition, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  unusable: "Unusable",
};

export type Asset = {
  id: ID;
  branch: string;
  assetTag: string;
  barcode: string;
  qrToken: string;
  categoryId: ID;
  type: AssetType;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate: string;
  cost: Money;
  vendorId?: ID;
  warrantyExpiry?: string;
  location: string;
  assignedToId?: ID;
  assignedToName?: string;
  department?: string;
  condition: AssetCondition;
  status: AssetStatus;
  usefulLifeYears: number;
  salvageValue: Money;
  depreciationMethod: DepreciationMethod;
  depreciationStartDate: string;
  /** Accumulated depreciation as of the last run, decimal-safe Money. */
  accumulatedDepreciation: Money;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export type AssignmentTargetType = "student" | "teacher" | "staff" | "department" | "classroom" | "lab" | "office" | "branch";

export const assignmentTargetTypeLabels: Record<AssignmentTargetType, string> = {
  student: "Student",
  teacher: "Teacher",
  staff: "Staff",
  department: "Department",
  classroom: "Classroom",
  lab: "Lab",
  office: "Office",
  branch: "Branch",
};

export type AssignmentStatus = "active" | "returned" | "overdue" | "transferred";

export const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  active: "Active",
  returned: "Returned",
  overdue: "Overdue",
  transferred: "Transferred",
};

export type AssetAssignment = {
  id: ID;
  assetId: ID;
  targetType: AssignmentTargetType;
  targetId?: ID;
  targetName: string;
  assignedAt: string;
  expectedReturn?: string;
  returnedAt?: string;
  conditionAtIssue: AssetCondition;
  conditionAtReturn?: AssetCondition;
  acknowledged: boolean;
  status: AssignmentStatus;
  assignedBy: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

export type MaintenanceType = "preventive" | "repair" | "warranty" | "inspection" | "calibration" | "cleaning" | "software" | "custom";

export const maintenanceTypeLabels: Record<MaintenanceType, string> = {
  preventive: "Preventive maintenance",
  repair: "Repair",
  warranty: "Warranty repair",
  inspection: "Inspection",
  calibration: "Calibration",
  cleaning: "Cleaning",
  software: "Software service",
  custom: "Custom maintenance",
};

export type MaintenanceStatus = "due" | "overdue" | "in-progress" | "completed" | "cancelled";

export const assetMaintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  due: "Due",
  overdue: "Overdue",
  "in-progress": "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type AssetMaintenance = {
  id: ID;
  assetId: ID;
  type: MaintenanceType;
  status: MaintenanceStatus;
  scheduledDate: string;
  completedDate?: string;
  cost?: Money;
  vendorId?: ID;
  downtimeHours?: number;
  nextServiceDate?: string;
  performedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Depreciation schedule entries
// ---------------------------------------------------------------------------

export type AssetDepreciation = {
  id: ID;
  assetId: ID;
  periodLabel: string;
  method: DepreciationMethod;
  openingBookValue: Money;
  depreciationAmount: Money;
  accumulatedDepreciation: Money;
  closingBookValue: Money;
  runAt: string;
};

// ---------------------------------------------------------------------------
// Disposal
// ---------------------------------------------------------------------------

export type DisposalReason = "end-of-life" | "damaged" | "sold" | "donated" | "lost" | "stolen" | "replaced" | "other";

export const disposalReasonLabels: Record<DisposalReason, string> = {
  "end-of-life": "End of life",
  damaged: "Damaged beyond repair",
  sold: "Sold",
  donated: "Donated",
  lost: "Lost",
  stolen: "Stolen",
  replaced: "Replaced",
  other: "Other",
};

export type DisposalStatus = "requested" | "reviewed" | "approved" | "completed" | "rejected";

export const disposalStatusLabels: Record<DisposalStatus, string> = {
  requested: "Requested",
  reviewed: "Reviewed",
  approved: "Approved",
  completed: "Completed",
  rejected: "Rejected",
};

export type AssetDisposal = {
  id: ID;
  assetId: ID;
  reason: DisposalReason;
  status: DisposalStatus;
  requestedBy: string;
  approvedBy?: string;
  disposalValue?: Money;
  recipient?: string;
  /** Links to the Phase 5 journal entry created on completion. */
  journalEntryId?: ID;
  notes?: string;
  requestedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};
