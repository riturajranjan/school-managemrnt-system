import type { Db } from "@/lib/data/store";

export type CampusPulseFactor = { key: string; label: string; score: number; displayValue: string; tone: "success" | "warning" | "error" };
export type CampusPulse = { score: number; factors: CampusPulseFactor[] };

function toneFor(score: number): "success" | "warning" | "error" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "error";
}

const TODAY = () => new Date().toISOString().slice(0, 10);

/** Operational campus-services health score (0-100). Strictly administrative —
 * NEVER a medical/mental-health diagnosis or student-risk prediction. Every
 * factor is a service-operations metric derived from live mock state. */
export function computeCampusPulse(db: Db): CampusPulse {
  const today = TODAY();
  const activeAllocations = db.hostelAllocations.filter((a) => a.status === "active");

  // Hostel attendance completeness — share of boarders with tonight's attendance marked and accounted.
  const marked = db.hostelAttendance.filter((a) => a.date === today && a.status !== "not-checked-in").length;
  const attendanceScore = activeAllocations.length > 0 ? Math.round((marked / activeAllocations.length) * 100) : 100;

  // Room occupancy health — share of rooms not in maintenance/closed.
  const usableRooms = db.hostelRooms.filter((r) => r.status !== "maintenance" && r.status !== "closed").length;
  const occupancyScore = db.hostelRooms.length > 0 ? Math.round((usableRooms / db.hostelRooms.length) * 100) : 100;

  // Maintenance load — inverse of open maintenance + complaints.
  const openMaint = db.hostelMaintenance.filter((m) => m.status !== "resolved" && m.status !== "closed").length;
  const openComplaints = db.hostelComplaints.filter((c) => c.status !== "resolved" && c.status !== "closed").length;
  const maintScore = Math.max(0, 100 - (openMaint + openComplaints) * 5);

  // Infirmary workload — inverse of currently-active visits (waiting/being-seen/resting).
  const activeVisits = db.healthVisits.filter((v) => v.status === "waiting" || v.status === "being-seen" || v.status === "resting").length;
  const infirmaryScore = Math.max(0, 100 - activeVisits * 8);

  // Follow-up completion — inverse of overdue health follow-ups.
  const overdueFollowUps = db.healthVisits.filter((v) => v.followUpDate && v.followUpDate < today).length + db.healthIncidents.filter((i) => i.followUpDate && i.followUpDate < today && i.status !== "resolved" && i.status !== "closed").length;
  const followUpScore = Math.max(0, 100 - overdueFollowUps * 12);

  // Meal-service readiness — inverse of out-of-stock items + inactive counters.
  const outOfStock = db.cafeteriaInventory.filter((i) => i.status === "out-of-stock").length;
  const lowStock = db.cafeteriaInventory.filter((i) => i.status === "low-stock").length;
  const inactiveCounters = db.cafeteriaCounters.filter((c) => !c.active).length;
  const mealScore = Math.max(0, 100 - outOfStock * 20 - lowStock * 5 - inactiveCounters * 5);

  // Open campus-service issues — inverse of open incidents + overdue leave returns.
  const openIncidents = db.healthIncidents.filter((i) => i.status === "open" || i.status === "monitoring").length;
  const overdueLeave = db.hostelLeave.filter((l) => l.status === "overdue").length;
  const issuesScore = Math.max(0, 100 - openIncidents * 8 - overdueLeave * 10);

  const factors: CampusPulseFactor[] = [
    { key: "attendance", label: "Hostel attendance", score: attendanceScore, displayValue: `${marked}/${activeAllocations.length} marked`, tone: toneFor(attendanceScore) },
    { key: "occupancy", label: "Room readiness", score: occupancyScore, displayValue: `${db.hostelRooms.length - usableRooms} under maintenance`, tone: toneFor(occupancyScore) },
    { key: "maintenance", label: "Maintenance load", score: maintScore, displayValue: `${openMaint + openComplaints} open`, tone: toneFor(maintScore) },
    { key: "infirmary", label: "Infirmary workload", score: infirmaryScore, displayValue: `${activeVisits} active`, tone: toneFor(infirmaryScore) },
    { key: "followup", label: "Follow-up completion", score: followUpScore, displayValue: `${overdueFollowUps} overdue`, tone: toneFor(followUpScore) },
    { key: "meals", label: "Meal-service readiness", score: mealScore, displayValue: `${outOfStock} out of stock`, tone: toneFor(mealScore) },
    { key: "issues", label: "Open service issues", score: issuesScore, displayValue: `${openIncidents + overdueLeave} to review`, tone: toneFor(issuesScore) },
  ];

  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.score, 0) / factors.length)));
  return { score, factors };
}
