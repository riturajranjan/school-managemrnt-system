import type { Db } from "@/lib/data/store";

const TODAY = () => new Date().toISOString().slice(0, 10);

export type HostelSummary = {
  residents: number;
  capacity: number;
  occupied: number;
  available: number;
  occupancyPercent: number;
  presentTonight: number;
  onLeave: number;
  vacantRooms: number;
  openComplaints: number;
  maintenanceRequests: number;
  visitorsToday: number;
};

export function hostelSummary(db: Db): HostelSummary {
  const today = TODAY();
  const active = db.hostelAllocations.filter((a) => a.status === "active");
  const usableBeds = db.hostelBeds.filter((b) => b.status !== "blocked" && b.status !== "maintenance");
  const occupied = db.hostelBeds.filter((b) => b.status === "occupied").length;
  const att = db.hostelAttendance.filter((a) => a.date === today);
  return {
    residents: active.length,
    capacity: usableBeds.length,
    occupied,
    available: usableBeds.length - occupied,
    occupancyPercent: usableBeds.length > 0 ? Math.round((occupied / usableBeds.length) * 100) : 0,
    presentTonight: att.filter((a) => a.status === "present").length,
    onLeave: att.filter((a) => a.status === "on-leave").length,
    vacantRooms: db.hostelRooms.filter((r) => r.status === "available").length,
    openComplaints: db.hostelComplaints.filter((c) => c.status !== "resolved" && c.status !== "closed").length,
    maintenanceRequests: db.hostelMaintenance.filter((m) => m.status !== "resolved" && m.status !== "closed").length,
    visitorsToday: db.hostelVisitors.filter((v) => v.date === today).length,
  };
}

export type HealthSummary = {
  visitsToday: number;
  resting: number;
  followUps: number;
  openIncidents: number;
  medicationsDue: number;
  appointments: number;
};

export function healthSummary(db: Db): HealthSummary {
  const today = TODAY();
  return {
    visitsToday: db.healthVisits.filter((v) => v.arrivalAt.slice(0, 10) === today).length,
    resting: db.healthVisits.filter((v) => v.status === "resting").length,
    followUps: db.healthVisits.filter((v) => v.followUpDate && v.followUpDate >= today).length + db.healthIncidents.filter((i) => i.followUpDate && i.followUpDate >= today).length,
    openIncidents: db.healthIncidents.filter((i) => i.status === "open" || i.status === "monitoring").length,
    medicationsDue: db.medicationRecords.filter((m) => m.status === "due" || m.status === "scheduled").length,
    appointments: db.healthAppointments.filter((a) => a.status === "scheduled" || a.status === "requested").length,
  };
}

export type CafeteriaSummary = {
  mealsServedMock: number;
  activeCounters: number;
  mealPlanUsers: number;
  pendingOrders: number;
  outOfStock: number;
  feedbackCount: number;
};

export function cafeteriaSummary(db: Db): CafeteriaSummary {
  return {
    mealsServedMock: db.cafeteriaOrders.filter((o) => o.status === "collected").length + db.hostelAllocations.filter((a) => a.status === "active").length,
    activeCounters: db.cafeteriaCounters.filter((c) => c.active).length,
    mealPlanUsers: db.mealPlanEnrollments.filter((e) => e.status === "active").length,
    pendingOrders: db.cafeteriaOrders.filter((o) => o.status === "placed" || o.status === "preparing").length,
    outOfStock: db.cafeteriaInventory.filter((i) => i.status === "out-of-stock").length,
    feedbackCount: db.cafeteriaFeedback.length,
  };
}
