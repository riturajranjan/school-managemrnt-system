import type { ID } from "./common";
import type { Money } from "@/lib/finance/money";

// ---------------------------------------------------------------------------
// Shared transport enums
// ---------------------------------------------------------------------------

export type TransportShift = "morning" | "afternoon" | "evening" | "both";

export const transportShiftLabels: Record<TransportShift, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  both: "Both",
};

/** Default pickup/drop time prefilled when a new stop is added to a route
 * on this shift — editable from /transport/settings, consumed by the
 * route-builder form so the default isn't a hardcoded literal. */
export type TransportShiftPolicy = {
  shift: TransportShift;
  defaultPickupTime: string;
  defaultDropTime: string;
};

export type TransportDocumentStatus = "valid" | "expiring-soon" | "expired" | "missing" | "under-review" | "rejected";

export const transportDocumentStatusLabels: Record<TransportDocumentStatus, string> = {
  valid: "Valid",
  "expiring-soon": "Expiring soon",
  expired: "Expired",
  missing: "Missing",
  "under-review": "Under review",
  rejected: "Rejected",
};

// ---------------------------------------------------------------------------
// Stops
// ---------------------------------------------------------------------------

export type StopStatus = "active" | "temporary" | "unsafe" | "alternate" | "inactive";

export const stopStatusLabels: Record<StopStatus, string> = {
  active: "Active",
  temporary: "Temporary",
  unsafe: "Unsafe",
  alternate: "Alternate",
  inactive: "Inactive",
};

export type TransportStop = {
  id: ID;
  name: string;
  code: string;
  address: string;
  landmark?: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  branch: string;
  safetyNotes?: string;
  status: StopStatus;
  alternateStopId?: ID;
  createdAt: string;
  updatedAt: string;
};

/** Join record — a stop's role on one specific route (sequence, timing,
 * waiting time). The same physical TransportStop can appear on multiple
 * routes with different sequence/timing via separate RouteStop rows. */
export type RouteStop = {
  id: ID;
  routeId: ID;
  stopId: ID;
  sequence: number;
  pickupTime?: string;
  dropTime?: string;
  waitingMinutes: number;
  distanceFromPreviousKm?: number;
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export type RouteDirection = "pickup" | "drop" | "both";

export const routeDirectionLabels: Record<RouteDirection, string> = {
  pickup: "Pickup",
  drop: "Drop",
  both: "Both",
};

export type RouteType = "morning-pickup" | "afternoon-drop" | "evening-activity" | "staff-transport" | "exam-route" | "event-route" | "special-route" | "temporary-route";

export const routeTypeLabels: Record<RouteType, string> = {
  "morning-pickup": "Morning pickup",
  "afternoon-drop": "Afternoon drop",
  "evening-activity": "Evening activity",
  "staff-transport": "Staff transport",
  "exam-route": "Exam route",
  "event-route": "Event route",
  "special-route": "Special route",
  "temporary-route": "Temporary route",
};

export type RouteStatus = "draft" | "active" | "paused" | "temporary" | "under-review" | "archived";

export const routeStatusLabels: Record<RouteStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  temporary: "Temporary",
  "under-review": "Under review",
  archived: "Archived",
};

export type VehicleType = "bus" | "mini-bus" | "van" | "car" | "electric-vehicle" | "contract-vehicle" | "custom";

export const vehicleTypeLabels: Record<VehicleType, string> = {
  bus: "Bus",
  "mini-bus": "Mini bus",
  van: "Van",
  car: "Car",
  "electric-vehicle": "Electric vehicle",
  "contract-vehicle": "Contract vehicle",
  custom: "Custom type",
};

export type TransportRoute = {
  id: ID;
  name: string;
  code: string;
  branch: string;
  shift: TransportShift;
  direction: RouteDirection;
  type: RouteType;
  startPoint: string;
  endPoint: string;
  distanceKm: number;
  estimatedDurationMinutes: number;
  vehicleType: VehicleType;
  maxCapacity: number;
  assignedVehicleId?: ID;
  primaryDriverId?: ID;
  backupDriverId?: ID;
  attendantId?: ID;
  effectiveFrom: string;
  effectiveTo?: string;
  status: RouteStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Vehicles, seating, documents
// ---------------------------------------------------------------------------

export type FuelType = "diesel" | "petrol" | "cng" | "electric" | "hybrid";

export const fuelTypeLabels: Record<FuelType, string> = {
  diesel: "Diesel",
  petrol: "Petrol",
  cng: "CNG",
  electric: "Electric",
  hybrid: "Hybrid",
};

export type VehicleStatus = "available" | "assigned" | "in-service" | "maintenance" | "breakdown" | "documents-expired" | "inactive" | "retired";

export const vehicleStatusLabels: Record<VehicleStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  "in-service": "In service",
  maintenance: "Maintenance",
  breakdown: "Breakdown",
  "documents-expired": "Documents expired",
  inactive: "Inactive",
  retired: "Retired",
};

export type OwnershipType = "owned" | "leased" | "contracted";

export const ownershipTypeLabels: Record<OwnershipType, string> = {
  owned: "Owned",
  leased: "Leased",
  contracted: "Contracted",
};

export type Vehicle = {
  id: ID;
  registrationNumber: string;
  fleetNumber: string;
  type: VehicleType;
  make: string;
  model: string;
  year: number;
  capacity: number;
  fuelType: FuelType;
  chassisNumber: string;
  engineNumber: string;
  odometerKm: number;
  gpsDeviceId?: ID;
  branch: string;
  status: VehicleStatus;
  purchaseDate?: string;
  ownershipType: OwnershipType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type SeatType = "standard" | "reserved" | "wheelchair" | "staff" | "attendant" | "unavailable" | "emergency-exit";

export const seatTypeLabels: Record<SeatType, string> = {
  standard: "Standard",
  reserved: "Reserved",
  wheelchair: "Wheelchair space",
  staff: "Staff seat",
  attendant: "Attendant seat",
  unavailable: "Unavailable",
  "emergency-exit": "Emergency exit",
};

export type VehicleSeat = {
  id: ID;
  vehicleId: ID;
  seatNumber: string;
  row: number;
  column: number;
  type: SeatType;
  studentId?: ID;
  routeId?: ID;
};

export type VehicleDocumentType = "registration" | "insurance" | "permit" | "fitness-certificate" | "pollution-certificate" | "road-tax" | "gps-certificate" | "custom";

export const vehicleDocumentTypeLabels: Record<VehicleDocumentType, string> = {
  registration: "Registration",
  insurance: "Insurance",
  permit: "Permit",
  "fitness-certificate": "Fitness certificate",
  "pollution-certificate": "Pollution certificate",
  "road-tax": "Road tax",
  "gps-certificate": "GPS certificate",
  custom: "Custom document",
};

export type VehicleDocument = {
  id: ID;
  vehicleId: ID;
  type: VehicleDocumentType;
  documentNumber?: string;
  issuedBy?: string;
  issueDate?: string;
  expiryDate?: string;
  status: TransportDocumentStatus;
  fileName?: string;
  notes?: string;
};

/** Historical record of which driver/attendant a vehicle ran with on a given
 * route over a date range — distinct from TransportRoute's current
 * `assignedVehicleId` pointer, which only reflects the present assignment. */
export type VehicleAssignment = {
  id: ID;
  vehicleId: ID;
  routeId: ID;
  driverId?: ID;
  attendantId?: ID;
  effectiveFrom: string;
  effectiveTo?: string;
  status: "active" | "ended";
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Drivers and attendants
// ---------------------------------------------------------------------------

export type DriverStatus = "available" | "assigned" | "on-trip" | "on-leave" | "suspended" | "license-expired" | "medical-review" | "inactive";

export const driverStatusLabels: Record<DriverStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  "on-trip": "On trip",
  "on-leave": "On leave",
  suspended: "Suspended",
  "license-expired": "License expired",
  "medical-review": "Medical review",
  inactive: "Inactive",
};

export type Driver = {
  id: ID;
  name: string;
  employeeCode: string;
  phone: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  address?: string;
  photoUrl?: string;
  dob?: string;
  joiningDate: string;
  licenseNumber: string;
  licenseClass: string;
  licenseExpiry: string;
  badgeNumber?: string;
  backgroundVerified: boolean;
  medicalFitnessValid: boolean;
  branch: string;
  status: DriverStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type DriverDocumentType = "license" | "badge" | "medical-fitness" | "background-verification" | "custom";

export const driverDocumentTypeLabels: Record<DriverDocumentType, string> = {
  license: "License",
  badge: "Badge",
  "medical-fitness": "Medical fitness",
  "background-verification": "Background verification",
  custom: "Custom document",
};

export type DriverDocument = {
  id: ID;
  driverId: ID;
  type: DriverDocumentType;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  status: TransportDocumentStatus;
  fileName?: string;
  notes?: string;
};

export type DriverTraining = {
  id: ID;
  driverId: ID;
  title: string;
  completedAt: string;
  expiresAt?: string;
  conductedBy?: string;
  notes?: string;
};

export type DriverAvailabilityStatus = "available" | "unavailable" | "on-leave";

export const driverAvailabilityStatusLabels: Record<DriverAvailabilityStatus, string> = {
  available: "Available",
  unavailable: "Unavailable",
  "on-leave": "On leave",
};

export type DriverAvailability = {
  id: ID;
  driverId: ID;
  date: string;
  status: DriverAvailabilityStatus;
  reason?: string;
};

export type AttendantStatus = "available" | "assigned" | "on-trip" | "on-leave" | "inactive";

export const attendantStatusLabels: Record<AttendantStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  "on-trip": "On trip",
  "on-leave": "On leave",
  inactive: "Inactive",
};

export type Attendant = {
  id: ID;
  name: string;
  employeeCode: string;
  phone: string;
  emergencyContactPhone?: string;
  photoUrl?: string;
  joiningDate: string;
  branch: string;
  status: AttendantStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Student / staff transport assignment
// ---------------------------------------------------------------------------

export type TransportAssignmentStatus = "active" | "suspended" | "withdrawn" | "expired";

export const transportAssignmentStatusLabels: Record<TransportAssignmentStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

/** The real, relational transport assignment — the source of truth. The
 * lightweight `Student.transport` field (StudentTransportSummary, in
 * lib/types/students.ts) is only a denormalized display snapshot derived
 * from this record. */
export type StudentTransportAssignment = {
  id: ID;
  studentId: ID;
  session: string;
  routeId: ID;
  pickupStopId: ID;
  dropStopId: ID;
  shift: TransportShift;
  vehicleId?: ID;
  seatId?: ID;
  feeRuleId?: ID;
  specialInstructions?: string;
  status: TransportAssignmentStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type StaffTransportAssignment = {
  id: ID;
  staffName: string;
  staffId: ID;
  routeId: ID;
  pickupStopId: ID;
  shift: TransportShift;
  status: TransportAssignmentStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

export type TripStatus = "scheduled" | "ready" | "boarding" | "in-progress" | "delayed" | "paused" | "breakdown" | "emergency" | "completed" | "cancelled";

export const tripStatusLabels: Record<TripStatus, string> = {
  scheduled: "Scheduled",
  ready: "Ready",
  boarding: "Boarding",
  "in-progress": "In progress",
  delayed: "Delayed",
  paused: "Paused",
  breakdown: "Breakdown",
  emergency: "Emergency",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type TransportTrip = {
  id: ID;
  tripNumber: string;
  routeId: ID;
  direction: RouteDirection;
  date: string;
  shift: TransportShift;
  vehicleId: ID;
  driverId: ID;
  attendantId?: ID;
  plannedStart: string;
  actualStart?: string;
  plannedEnd: string;
  actualEnd?: string;
  studentsExpected: number;
  studentsBoarded: number;
  studentsDropped: number;
  distanceKm?: number;
  status: TripStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type TripStopStatus = "pending" | "arrived" | "departed" | "skipped";

export const tripStopStatusLabels: Record<TripStopStatus, string> = {
  pending: "Pending",
  arrived: "Arrived",
  departed: "Departed",
  skipped: "Skipped",
};

export type TripStop = {
  id: ID;
  tripId: ID;
  stopId: ID;
  sequence: number;
  plannedArrival: string;
  actualArrival?: string;
  plannedDeparture: string;
  actualDeparture?: string;
  status: TripStopStatus;
};

export type PickupStatus = "expected" | "waiting" | "boarded" | "missed" | "absent" | "cancelled-by-parent" | "alternate-pickup" | "not-confirmed";

export const pickupStatusLabels: Record<PickupStatus, string> = {
  expected: "Expected",
  waiting: "Waiting",
  boarded: "Boarded",
  missed: "Missed",
  absent: "Absent",
  "cancelled-by-parent": "Cancelled by parent",
  "alternate-pickup": "Alternate pickup",
  "not-confirmed": "Not confirmed",
};

export type DropStatus = "onboard" | "approaching" | "dropped" | "parent-unavailable" | "alternate-guardian" | "returned-to-school" | "not-confirmed";

export const dropStatusLabels: Record<DropStatus, string> = {
  onboard: "Onboard",
  approaching: "Approaching",
  dropped: "Dropped",
  "parent-unavailable": "Parent unavailable",
  "alternate-guardian": "Alternate guardian",
  "returned-to-school": "Returned to school",
  "not-confirmed": "Not confirmed",
};

export type TripStudent = {
  id: ID;
  tripId: ID;
  studentId: ID;
  stopId: ID;
  pickupStatus: PickupStatus;
  dropStatus: DropStatus;
};

export type VerificationMethod = "driver-confirmation" | "attendant-confirmation" | "qr-scan" | "pin" | "parent-app-confirmation" | "authorized-guardian" | "manual-with-reason";

export const verificationMethodLabels: Record<VerificationMethod, string> = {
  "driver-confirmation": "Driver confirmation",
  "attendant-confirmation": "Attendant confirmation",
  "qr-scan": "QR scan",
  pin: "PIN",
  "parent-app-confirmation": "Parent app confirmation",
  "authorized-guardian": "Authorized guardian",
  "manual-with-reason": "Manual (with reason)",
};

export type PickupRecord = {
  id: ID;
  tripId: ID;
  studentId: ID;
  stopId: ID;
  status: PickupStatus;
  verificationMethod?: VerificationMethod;
  recordedBy: string;
  recordedAt: string;
  reason?: string;
};

export type DropRecord = {
  id: ID;
  tripId: ID;
  studentId: ID;
  stopId: ID;
  status: DropStatus;
  verificationMethod?: VerificationMethod;
  guardianName?: string;
  recordedBy: string;
  recordedAt: string;
  reason?: string;
};

/** Per-student, per-trip attendance rollup — kept separate from school
 * attendance (Phase 2's AttendanceRecord) by design; the two are only
 * synced when a school explicitly configures that link, never automatically. */
export type TransportAttendance = {
  id: ID;
  tripId: ID;
  studentId: ID;
  routeId: ID;
  date: string;
  pickupStatus: PickupStatus;
  dropStatus: DropStatus;
  notes?: string;
};

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

export type IncidentType = "breakdown" | "accident" | "medical-issue" | "student-behavior" | "missed-student" | "parent-unavailable" | "route-blockage" | "vehicle-damage" | "driver-issue" | "gps-failure" | "safety-concern" | "lost-item" | "other";

export const incidentTypeLabels: Record<IncidentType, string> = {
  breakdown: "Breakdown",
  accident: "Accident",
  "medical-issue": "Medical issue",
  "student-behavior": "Student behavior",
  "missed-student": "Missed student",
  "parent-unavailable": "Parent unavailable",
  "route-blockage": "Route blockage",
  "vehicle-damage": "Vehicle damage",
  "driver-issue": "Driver issue",
  "gps-failure": "GPS failure",
  "safety-concern": "Safety concern",
  "lost-item": "Lost item",
  other: "Other",
};

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export const incidentSeverityLabels: Record<IncidentSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export type IncidentStatus = "open" | "investigating" | "action-required" | "resolved" | "closed" | "escalated";

export const incidentStatusLabels: Record<IncidentStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  "action-required": "Action required",
  resolved: "Resolved",
  closed: "Closed",
  escalated: "Escalated",
};

export type TransportIncident = {
  id: ID;
  incidentNumber: string;
  type: IncidentType;
  occurredAt: string;
  vehicleId?: ID;
  routeId?: ID;
  tripId?: ID;
  location?: string;
  reportedBy: string;
  peopleInvolved?: string;
  severity: IncidentSeverity;
  description: string;
  attachmentName?: string;
  immediateAction?: string;
  parentCommunicated: boolean;
  authorityCommunicated: boolean;
  followUp?: string;
  resolution?: string;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Maintenance and fuel
// ---------------------------------------------------------------------------

export type MaintenanceType = "routine-service" | "preventive-maintenance" | "repair" | "breakdown-repair" | "tyre-replacement" | "battery-replacement" | "inspection" | "cleaning" | "gps-device-service" | "custom";

export const maintenanceTypeLabels: Record<MaintenanceType, string> = {
  "routine-service": "Routine service",
  "preventive-maintenance": "Preventive maintenance",
  repair: "Repair",
  "breakdown-repair": "Breakdown repair",
  "tyre-replacement": "Tyre replacement",
  "battery-replacement": "Battery replacement",
  inspection: "Inspection",
  cleaning: "Cleaning",
  "gps-device-service": "GPS device service",
  custom: "Custom maintenance",
};

export type MaintenanceStatus = "scheduled" | "due-soon" | "overdue" | "in-progress" | "completed" | "cancelled";

export const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  scheduled: "Scheduled",
  "due-soon": "Due soon",
  overdue: "Overdue",
  "in-progress": "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type MaintenancePart = {
  id: ID;
  maintenanceId: ID;
  name: string;
  quantity: number;
  cost: Money;
};

export type MaintenanceRecord = {
  id: ID;
  vehicleId: ID;
  type: MaintenanceType;
  odometerKm?: number;
  scheduledDate: string;
  completedDate?: string;
  vendor?: string;
  cost: Money;
  labourCost: Money;
  parts: MaintenancePart[];
  downtimeHours?: number;
  notes?: string;
  attachmentName?: string;
  nextDueDate?: string;
  nextDueOdometerKm?: number;
  status: MaintenanceStatus;
  createdAt: string;
};

export type FuelRecord = {
  id: ID;
  vehicleId: ID;
  date: string;
  odometerKm: number;
  quantityLitres: number;
  fuelType: FuelType;
  rate: Money;
  totalCost: Money;
  vendor?: string;
  filledBy: string;
  fullTank: boolean;
  notes?: string;
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type TransportNotificationTrigger =
  | "bus-departed"
  | "bus-approaching-stop"
  | "student-boarded"
  | "student-missed-pickup"
  | "student-dropped"
  | "parent-unavailable"
  | "delay"
  | "route-deviation"
  | "breakdown"
  | "vehicle-replacement"
  | "driver-replacement"
  | "route-change"
  | "stop-change"
  | "trip-cancelled"
  | "emergency"
  | "document-expiry"
  | "maintenance-delay";

export const transportNotificationTriggerLabels: Record<TransportNotificationTrigger, string> = {
  "bus-departed": "Bus departed",
  "bus-approaching-stop": "Bus approaching stop",
  "student-boarded": "Student boarded",
  "student-missed-pickup": "Student missed pickup",
  "student-dropped": "Student dropped",
  "parent-unavailable": "Parent unavailable",
  delay: "Delay",
  "route-deviation": "Route deviation",
  breakdown: "Breakdown",
  "vehicle-replacement": "Vehicle replacement",
  "driver-replacement": "Driver replacement",
  "route-change": "Route change",
  "stop-change": "Stop change",
  "trip-cancelled": "Trip cancelled",
  emergency: "Emergency",
  "document-expiry": "Document expiry",
  "maintenance-delay": "Maintenance delay",
};

export type TransportNotificationChannel = "in-app" | "push" | "sms" | "whatsapp" | "email";

export const transportNotificationChannelLabels: Record<TransportNotificationChannel, string> = {
  "in-app": "In-app",
  push: "Push",
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
};

export type TransportNotificationAudience = "parent" | "student" | "driver" | "attendant" | "transport-office";

export const transportNotificationAudienceLabels: Record<TransportNotificationAudience, string> = {
  parent: "Parent",
  student: "Student",
  driver: "Driver",
  attendant: "Attendant",
  "transport-office": "Transport office",
};

export type TransportNotificationRule = {
  id: ID;
  name: string;
  trigger: TransportNotificationTrigger;
  channels: TransportNotificationChannel[];
  audience: TransportNotificationAudience;
  templateEn: string;
  templateHi?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  escalateAfterMinutes?: number;
  retryCount?: number;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

export type TransportNotificationStatus = "sent" | "failed" | "queued";

export const transportNotificationStatusLabels: Record<TransportNotificationStatus, string> = {
  sent: "Sent",
  failed: "Failed",
  queued: "Queued",
};

export type TransportNotification = {
  id: ID;
  ruleId?: ID;
  trigger: TransportNotificationTrigger;
  channel: TransportNotificationChannel;
  audience: TransportNotificationAudience;
  recipientId: ID;
  studentId?: ID;
  tripId?: ID;
  message: string;
  sentAt: string;
  status: TransportNotificationStatus;
};

// ---------------------------------------------------------------------------
// Transport fees
// ---------------------------------------------------------------------------

export type TransportFeeBasis = "route" | "distance" | "stop" | "vehicle-type" | "flat";

export const transportFeeBasisLabels: Record<TransportFeeBasis, string> = {
  route: "Route-based",
  distance: "Distance-based",
  stop: "Stop-based",
  "vehicle-type": "Vehicle-type-based",
  flat: "Flat",
};

export type TransportFeeFrequency = "monthly" | "quarterly" | "annual" | "one-time";

export const transportFeeFrequencyLabels: Record<TransportFeeFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  "one-time": "One-time",
};

export type TransportFeeRule = {
  id: ID;
  name: string;
  basis: TransportFeeBasis;
  routeId?: ID;
  vehicleType?: VehicleType;
  amount: Money;
  frequency: TransportFeeFrequency;
  session: string;
  siblingDiscountPercent?: number;
  staffDiscountPercent?: number;
  status: "active" | "inactive";
  createdAt: string;
};

export type TransportFeeChargeStatus = "pending" | "partial" | "paid" | "waived" | "cancelled";

export const transportFeeChargeStatusLabels: Record<TransportFeeChargeStatus, string> = {
  pending: "Pending",
  partial: "Partially paid",
  paid: "Paid",
  waived: "Waived",
  cancelled: "Cancelled",
};

/** One billed transport-fee period for one student or staff rider — generated
 * from a TransportFeeRule at billing time via generateChargesForPeriod().
 * Kept as its own ledger (not written into Phase 5's StudentFeeItem table)
 * since a student's transport charge varies by route/discount in ways the
 * flat, structure-wide FeeComponent model doesn't represent per student. */
export type TransportFeeCharge = {
  id: ID;
  feeRuleId: ID;
  subjectType: "student" | "staff";
  studentId?: ID;
  staffId?: ID;
  assignmentId: ID;
  session: string;
  period: string;
  billedAmount: Money;
  discountPercent?: number;
  paidAmount: Money;
  dueDate: string;
  status: TransportFeeChargeStatus;
  createdAt: string;
};
