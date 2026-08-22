import { getSnapshot, setState } from "@/lib/data/store";
import type { HostelLeaveStatus, ComplaintStatus, MaintenanceStatus, HostelVisitorStatus } from "@/lib/types/hostel";
import type { VisitStatus, IncidentStatus, MedicationStatus, CounsellingStatus } from "@/lib/types/health";
import type { CafeteriaOrder, CafeteriaOrderItem, OrderStatus } from "@/lib/types/cafeteria";
import { generateId } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

// Hostel bed allocation (allocateBed/endAllocation/setBedStatus/
// markHostelAttendance) went real in Phase 9Q (lib/server/hostel/*) and was
// deleted here as dead mock authority — real surfaces must use
// hooks/api/use-hostel-api. Leave/Complaints/Maintenance/Visitors below stay
// mock (deferred — no real parent-approval/ticketing/extended-Visitor
// workflow exists yet).

export function setHostelLeaveStatus(leaveId: string, status: HostelLeaveStatus): Result {
  setState((db) => ({ ...db, hostelLeave: db.hostelLeave.map((l) => (l.id === leaveId ? { ...l, status } : l)) }));
  return { ok: true };
}

export function setComplaintStatus(complaintId: string, status: ComplaintStatus): Result {
  const now = new Date().toISOString();
  setState((db) => ({ ...db, hostelComplaints: db.hostelComplaints.map((c) => (c.id === complaintId ? { ...c, status, lastUpdate: now } : c)) }));
  return { ok: true };
}

export function setHostelMaintenanceStatus(id: string, status: MaintenanceStatus, assignedTo?: string): Result {
  setState((db) => ({ ...db, hostelMaintenance: db.hostelMaintenance.map((m) => (m.id === id ? { ...m, status, assignedTo: assignedTo ?? m.assignedTo } : m)) }));
  return { ok: true };
}

export function setHostelVisitorStatus(id: string, status: HostelVisitorStatus): Result {
  const now = new Date();
  setState((db) => ({ ...db, hostelVisitors: db.hostelVisitors.map((v) => (v.id === id ? { ...v, status, approvedBy: status === "approved" ? "Warden" : v.approvedBy, departureTime: status === "departed" ? now.toTimeString().slice(0, 5) : v.departureTime } : v)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export type VisitDraft = { studentId: string; reason: string; symptomsReported?: string; observationNotes?: string; careAction?: string; guardianContacted: boolean; staffName: string };

export function createHealthVisit(draft: VisitDraft): Result & { visitId?: string } {
  if (!draft.reason.trim()) return { ok: false, error: "Reason for visit is required." };
  const now = new Date().toISOString();
  const visit = { id: generateId("hv"), studentId: draft.studentId, arrivalAt: now, reason: draft.reason.trim(), symptomsReported: draft.symptomsReported, observationNotes: draft.observationNotes, careAction: draft.careAction, guardianContacted: draft.guardianContacted, referredExternally: false, staffName: draft.staffName, status: "being-seen" as VisitStatus };
  setState((db) => ({ ...db, healthVisits: [visit, ...db.healthVisits] }));
  return { ok: true, visitId: visit.id };
}

export function setVisitStatus(visitId: string, status: VisitStatus): Result {
  const now = new Date().toISOString();
  setState((db) => ({ ...db, healthVisits: db.healthVisits.map((v) => (v.id === visitId ? { ...v, status, restStart: status === "resting" && !v.restStart ? now : v.restStart } : v)) }));
  return { ok: true };
}

export function recordMedication(medId: string, staffName: string): Result {
  const now = new Date().toISOString();
  setState((db) => ({ ...db, medicationRecords: db.medicationRecords.map((m) => (m.id === medId ? { ...m, status: "recorded" as MedicationStatus, administeredAt: now, staffName } : m)) }));
  return { ok: true };
}

export function setMedicationStatus(medId: string, status: MedicationStatus): Result {
  setState((db) => ({ ...db, medicationRecords: db.medicationRecords.map((m) => (m.id === medId ? { ...m, status } : m)) }));
  return { ok: true };
}

export function setIncidentStatus(incidentId: string, status: IncidentStatus): Result {
  setState((db) => ({ ...db, healthIncidents: db.healthIncidents.map((i) => (i.id === incidentId ? { ...i, status } : i)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Counselling
// ---------------------------------------------------------------------------

export function setCounsellingStatus(appointmentId: string, status: CounsellingStatus): Result {
  setState((db) => ({ ...db, counsellingAppointments: db.counsellingAppointments.map((a) => (a.id === appointmentId ? { ...a, status } : a)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cafeteria
// ---------------------------------------------------------------------------

export function placeOrder(input: { studentName: string; studentId?: string; items: CafeteriaOrderItem[]; counter: string; pickupTime: string }): Result & { order?: CafeteriaOrder } {
  if (input.items.length === 0) return { ok: false, error: "Your cart is empty." };
  const db = getSnapshot();
  const totalMinor = input.items.reduce((s, it) => s + it.price.minorUnits * it.quantity, 0);
  const now = new Date().toISOString();
  const order: CafeteriaOrder = {
    id: generateId("ord"),
    orderNumber: `ORD-${String(db.cafeteriaOrders.length + 1).padStart(4, "0")}`,
    studentName: input.studentName,
    studentId: input.studentId,
    items: input.items,
    total: { minorUnits: totalMinor, currency: "INR" },
    counter: input.counter,
    pickupTime: input.pickupTime,
    status: "placed",
    tokenCode: `TKN${Math.floor(1000 + Math.random() * 9000)}`,
    createdAt: now,
  };
  setState((current) => ({ ...current, cafeteriaOrders: [order, ...current.cafeteriaOrders] }));
  return { ok: true, order };
}

export function setOrderStatus(orderId: string, status: OrderStatus): Result {
  setState((db) => ({ ...db, cafeteriaOrders: db.cafeteriaOrders.map((o) => (o.id === orderId ? { ...o, status } : o)) }));
  return { ok: true };
}

export function toggleMenuAvailability(itemId: string): Result {
  setState((db) => ({ ...db, menuItems: db.menuItems.map((m) => (m.id === itemId ? { ...m, available: !m.available } : m)) }));
  return { ok: true };
}
