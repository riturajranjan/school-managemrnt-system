import { getSnapshot, setState } from "@/lib/data/store";
import type { HostelAttendanceStatus, HostelLeaveStatus, ComplaintStatus, MaintenanceStatus, HostelVisitorStatus } from "@/lib/types/hostel";
import type { VisitStatus, IncidentStatus, MedicationStatus, CounsellingStatus } from "@/lib/types/health";
import type { CafeteriaOrder, CafeteriaOrderItem, OrderStatus } from "@/lib/types/cafeteria";
import { generateId } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Hostel — allocation with frontend-state integrity guards
// ---------------------------------------------------------------------------

/** Allocates a student to a bed. Prevents (in frontend state): double bed
 * allocation, allocation to blocked/maintenance beds or maintenance rooms, and
 * a duplicate active allocation for the same student. */
export function allocateBed(input: { studentId: string; bedId: string; expectedEnd?: string }): Result & { allocationId?: string } {
  const db = getSnapshot();
  const bed = db.hostelBeds.find((b) => b.id === input.bedId);
  if (!bed) return { ok: false, error: "Bed not found." };
  if (bed.status === "occupied") return { ok: false, error: "That bed is already occupied." };
  if (bed.status === "blocked" || bed.status === "maintenance") return { ok: false, error: `That bed is ${bed.status} and cannot be allocated.` };
  const room = db.hostelRooms.find((r) => r.id === bed.roomId);
  if (!room) return { ok: false, error: "Room not found." };
  if (room.status === "maintenance" || room.status === "closed") return { ok: false, error: `The room is under ${room.status} and cannot take allocations.` };
  if (db.hostelAllocations.some((a) => a.studentId === input.studentId && a.status === "active")) return { ok: false, error: "This student already has an active hostel allocation." };

  const now = new Date().toISOString();
  const allocation = { id: generateId("alloc"), studentId: input.studentId, buildingId: room.buildingId, roomId: room.id, bedId: bed.id, allocatedAt: now.slice(0, 10), expectedEnd: input.expectedEnd, status: "active" as const };
  setState((current) => ({
    ...current,
    hostelAllocations: [allocation, ...current.hostelAllocations],
    hostelBeds: current.hostelBeds.map((b) => (b.id === bed.id ? { ...b, status: "occupied", studentId: input.studentId, allocationDate: now.slice(0, 10), expectedEnd: input.expectedEnd } : b)),
    hostelRooms: recomputeRoomStatus(current.hostelRooms, current.hostelBeds.map((b) => (b.id === bed.id ? { ...b, status: "occupied" } : b)), room.id),
  }));
  return { ok: true, allocationId: allocation.id };
}

function recomputeRoomStatus(rooms: ReturnType<typeof getSnapshot>["hostelRooms"], beds: ReturnType<typeof getSnapshot>["hostelBeds"], roomId: string) {
  return rooms.map((r) => {
    if (r.id !== roomId || r.status === "maintenance" || r.status === "closed") return r;
    const rb = beds.filter((b) => b.roomId === r.id);
    const occ = rb.filter((b) => b.status === "occupied").length;
    return { ...r, status: occ === 0 ? "available" : occ >= r.capacity ? "full" : "partial" } as typeof r;
  });
}

export function endAllocation(allocationId: string): Result {
  const db = getSnapshot();
  const alloc = db.hostelAllocations.find((a) => a.id === allocationId);
  if (!alloc) return { ok: false, error: "Allocation not found." };
  setState((current) => {
    const beds = current.hostelBeds.map((b) => (b.id === alloc.bedId ? { ...b, status: "available" as const, studentId: undefined, allocationDate: undefined } : b));
    return { ...current, hostelAllocations: current.hostelAllocations.map((a) => (a.id === allocationId ? { ...a, status: "ended" } : a)), hostelBeds: beds, hostelRooms: recomputeRoomStatus(current.hostelRooms, beds, alloc.roomId) };
  });
  return { ok: true };
}

export function setBedStatus(bedId: string, status: "available" | "blocked" | "maintenance"): Result {
  const db = getSnapshot();
  const bed = db.hostelBeds.find((b) => b.id === bedId);
  if (!bed) return { ok: false, error: "Bed not found." };
  if (bed.status === "occupied") return { ok: false, error: "Cannot change status of an occupied bed. End the allocation first." };
  setState((current) => {
    const beds = current.hostelBeds.map((b) => (b.id === bedId ? { ...b, status } : b));
    return { ...current, hostelBeds: beds, hostelRooms: recomputeRoomStatus(current.hostelRooms, beds, bed.roomId) };
  });
  return { ok: true };
}

export function markHostelAttendance(studentId: string, date: string, status: HostelAttendanceStatus): Result {
  const db = getSnapshot();
  const existing = db.hostelAttendance.find((a) => a.studentId === studentId && a.date === date);
  setState((current) => {
    if (existing) return { ...current, hostelAttendance: current.hostelAttendance.map((a) => (a.id === existing.id ? { ...a, status } : a)) };
    return { ...current, hostelAttendance: [{ id: generateId("hatt"), studentId, date, status }, ...current.hostelAttendance] };
  });
  return { ok: true };
}

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
