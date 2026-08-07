import type { Db } from "@/lib/data/store";
import { computeDriverSafety } from "./driver-safety";
import { documentCompliance } from "./document-compliance";
import { isGpsStale, latestGpsPosition } from "./live-tracking";
import { tripDelayStats } from "./transport-reports";

export type TransportPulseFactor = { key: string; label: string; score: number; displayValue: string; tone: "success" | "warning" | "error" };
export type TransportPulse = { score: number; factors: TransportPulseFactor[] };

function toneFor(score: number): "success" | "warning" | "error" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "error";
}

/** A real, computed operational score (0-100) for today's fleet — every
 * factor is derived from actual store data (on-time trips, live GPS
 * coverage, fleet availability, document compliance, driver safety, open
 * incidents), never a decorative placeholder. Unweighted average across
 * factors, same pattern as Academic Pulse. */
export function computeTransportPulse(db: Db): TransportPulse {
  const today = new Date().toISOString().slice(0, 10);
  const todaysTrips = db.transportTrips.filter((t) => t.date === today);
  const activeTrips = todaysTrips.filter((t) => t.status !== "cancelled" && t.status !== "scheduled" && t.status !== "ready");

  const delays = tripDelayStats(db, 1);
  const onTimeScore = todaysTrips.length > 0 ? delays.onTimePercent : 100;

  const liveCoverageCount = activeTrips.filter((t) => {
    const position = latestGpsPosition(db, t.vehicleId);
    return position && !isGpsStale(position.recordedAt);
  }).length;
  const liveCoverageScore = activeTrips.length > 0 ? Math.round((liveCoverageCount / activeTrips.length) * 100) : 100;

  const unavailableVehicles = db.vehicles.filter((v) => v.status === "maintenance" || v.status === "breakdown" || v.status === "documents-expired" || v.status === "inactive" || v.status === "retired").length;
  const fleetAvailabilityScore = db.vehicles.length > 0 ? Math.round(((db.vehicles.length - unavailableVehicles) / db.vehicles.length) * 100) : 100;

  const compliance = documentCompliance(db);
  const complianceScore = Math.max(0, 100 - compliance.blockedVehicles.length * 15 - compliance.blockedDrivers.length * 15 - compliance.expiredCount * 5);

  const activeDrivers = db.drivers.filter((d) => d.status === "assigned" || d.status === "available" || d.status === "on-trip");
  const safetyScores = activeDrivers.map((d) => computeDriverSafety(db, d).score);
  const safetyScore = safetyScores.length > 0 ? Math.round(safetyScores.reduce((sum, s) => sum + s, 0) / safetyScores.length) : 100;

  const openIncidents = db.transportIncidents.filter((i) => i.status === "open" || i.status === "investigating" || i.status === "action-required");
  const criticalIncidents = openIncidents.filter((i) => i.severity === "critical" || i.severity === "high").length;
  const incidentScore = Math.max(0, 100 - openIncidents.length * 8 - criticalIncidents * 12);

  const factors: TransportPulseFactor[] = [
    { key: "onTime", label: "On-time trips", score: onTimeScore, displayValue: `${onTimeScore}%`, tone: toneFor(onTimeScore) },
    { key: "liveCoverage", label: "Live GPS coverage", score: liveCoverageScore, displayValue: `${liveCoverageCount}/${activeTrips.length} tracked`, tone: toneFor(liveCoverageScore) },
    { key: "fleetAvailability", label: "Fleet availability", score: fleetAvailabilityScore, displayValue: `${db.vehicles.length - unavailableVehicles}/${db.vehicles.length} available`, tone: toneFor(fleetAvailabilityScore) },
    { key: "compliance", label: "Document compliance", score: complianceScore, displayValue: `${compliance.expiredCount} expired`, tone: toneFor(complianceScore) },
    { key: "safety", label: "Driver safety", score: safetyScore, displayValue: `${safetyScore} avg`, tone: toneFor(safetyScore) },
    { key: "incidents", label: "Incident load", score: incidentScore, displayValue: `${openIncidents.length} open`, tone: toneFor(incidentScore) },
  ];

  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.score, 0) / factors.length)));
  return { score, factors };
}
