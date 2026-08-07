import type { Db } from "@/lib/data/store";
import { documentCompliance } from "./document-compliance";
import { fuelInsights } from "./fuel-insights";
import { isGpsStale, latestGpsPosition } from "./live-tracking";
import { maintenanceInsights } from "./maintenance-insights";

export type ExceptionSeverity = "high" | "medium" | "low";
export type TransportException = { id: string; severity: ExceptionSeverity; label: string; description: string; href: string };

/** Every row here points at something a real dispatcher/administrator must
 * act on today — never a decorative "all good" filler. An empty return means
 * there is genuinely nothing outstanding right now. */
export function transportExceptions(db: Db): TransportException[] {
  const exceptions: TransportException[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const openIncidents = db.transportIncidents.filter((i) => i.status === "open" || i.status === "investigating" || i.status === "action-required");
  const criticalIncidents = openIncidents.filter((i) => i.severity === "critical" || i.severity === "high");
  if (criticalIncidents.length > 0) {
    exceptions.push({ id: "critical-incidents", severity: "high", label: `${criticalIncidents.length} high/critical incident(s) open`, description: "Incidents needing immediate follow-up.", href: "/transport/incidents" });
  } else if (openIncidents.length > 0) {
    exceptions.push({ id: "open-incidents", severity: "medium", label: `${openIncidents.length} incident(s) open`, description: "Reported incidents awaiting resolution.", href: "/transport/incidents" });
  }

  const compliance = documentCompliance(db);
  if (compliance.blockedVehicles.length > 0) {
    exceptions.push({ id: "blocked-vehicles", severity: "high", label: `${compliance.blockedVehicles.length} vehicle(s) blocked from assignment`, description: "Expired or missing critical documents.", href: "/transport/documents" });
  }
  if (compliance.blockedDrivers.length > 0) {
    exceptions.push({ id: "blocked-drivers", severity: "high", label: `${compliance.blockedDrivers.length} driver(s) blocked from assignment`, description: "Expired or missing critical documents.", href: "/transport/documents" });
  }
  if (compliance.expiringSoonCount > 0) {
    exceptions.push({ id: "expiring-documents", severity: "low", label: `${compliance.expiringSoonCount} document(s) expiring soon`, description: "Vehicle/driver documents due for renewal within 30 days.", href: "/transport/documents" });
  }

  const maintenance = maintenanceInsights(db);
  if (maintenance.overdue.length > 0) {
    exceptions.push({ id: "overdue-maintenance", severity: "high", label: `${maintenance.overdue.length} maintenance record(s) overdue`, description: "Scheduled service or repairs past their due date.", href: "/transport/maintenance" });
  }

  const fuel = fuelInsights(db);
  if (fuel.anomalies.length > 0) {
    exceptions.push({ id: "fuel-anomalies", severity: "medium", label: `${fuel.anomalies.length} fuel efficiency anomal(y/ies)`, description: "Fill-ups showing mileage well below a vehicle's own average.", href: "/transport/fuel" });
  }

  const todaysTrips = db.transportTrips.filter((t) => t.date === today);
  const activeTrips = todaysTrips.filter((t) => t.status === "boarding" || t.status === "in-progress" || t.status === "delayed");
  const gpsOfflineTrips = activeTrips.filter((t) => {
    const position = latestGpsPosition(db, t.vehicleId);
    return !position || isGpsStale(position.recordedAt);
  });
  if (gpsOfflineTrips.length > 0) {
    exceptions.push({ id: "gps-offline", severity: "medium", label: `${gpsOfflineTrips.length} active trip(s) with no live GPS`, description: "GPS signal is stale or missing for a trip in progress.", href: "/transport/live" });
  }

  const overdueFees = db.transportFeeCharges.filter((c) => (c.status === "pending" || c.status === "partial") && c.dueDate < today);
  if (overdueFees.length > 0) {
    exceptions.push({ id: "overdue-fees", severity: "low", label: `${overdueFees.length} transport fee charge(s) overdue`, description: "Billed transport fees past their due date.", href: "/transport/fees" });
  }

  const severityRank: Record<ExceptionSeverity, number> = { high: 0, medium: 1, low: 2 };
  return exceptions.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

export type DailyTransportBrief = {
  tripsToday: number;
  tripsCompleted: number;
  tripsInProgress: number;
  tripsDelayed: number;
  tripsNotStarted: number;
  studentsInTransit: number;
};

export function dailyTransportBrief(db: Db): DailyTransportBrief {
  const today = new Date().toISOString().slice(0, 10);
  const todaysTrips = db.transportTrips.filter((t) => t.date === today);

  const tripsCompleted = todaysTrips.filter((t) => t.status === "completed").length;
  const tripsInProgress = todaysTrips.filter((t) => t.status === "in-progress" || t.status === "boarding").length;
  const tripsDelayed = todaysTrips.filter((t) => t.status === "delayed").length;
  const tripsNotStarted = todaysTrips.filter((t) => t.status === "scheduled" || t.status === "ready").length;
  const studentsInTransit = todaysTrips.filter((t) => t.status === "in-progress" || t.status === "boarding" || t.status === "delayed").reduce((sum, t) => sum + (t.studentsBoarded - t.studentsDropped), 0);

  return { tripsToday: todaysTrips.length, tripsCompleted, tripsInProgress, tripsDelayed, tripsNotStarted, studentsInTransit: Math.max(0, studentsInTransit) };
}
