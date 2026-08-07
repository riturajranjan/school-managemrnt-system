import type { Db } from "@/lib/data/store";
import type { Employee } from "@/lib/types/hr";

export type HrSummary = {
  activeStaff: number;
  presentToday: number;
  absentToday: number;
  onLeave: number;
  lateToday: number;
  newHires: number;
  openPositions: number;
  interviewsToday: number;
  contractsExpiring: number;
  documentsExpiring: number;
  appraisalsPending: number;
  trainingOverdue: number;
};

const TODAY = () => new Date().toISOString().slice(0, 10);

export function hrSummary(db: Db): HrSummary {
  const today = TODAY();
  const active = db.employees.filter((e) => e.status !== "inactive" && e.status !== "resigned" && e.status !== "retired");
  const todayAtt = db.hrAttendance.filter((a) => a.date === today);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 45);
  const soonIso = soon.toISOString().slice(0, 10);

  return {
    activeStaff: active.length,
    presentToday: todayAtt.filter((a) => a.status === "present" || a.status === "work-from-home" || a.status === "official-duty").length,
    absentToday: todayAtt.filter((a) => a.status === "absent").length,
    onLeave: db.employees.filter((e) => e.status === "on-leave").length,
    lateToday: todayAtt.filter((a) => a.status === "late").length,
    newHires: db.employees.filter((e) => e.joiningDate >= new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)).length,
    openPositions: db.recruitmentJobs.filter((j) => j.status === "open").reduce((s, j) => s + j.openings, 0),
    interviewsToday: db.interviews.filter((i) => i.date === today && i.status === "scheduled").length,
    contractsExpiring: db.contracts.filter((c) => c.status === "expiring" || (c.endDate && c.endDate >= today && c.endDate <= soonIso)).length,
    documentsExpiring: db.staffDocuments.filter((d) => d.status === "expiring" || d.status === "expired").length,
    appraisalsPending: db.performanceReviews.filter((r) => r.stage !== "completed").length,
    trainingOverdue: db.trainingEnrollments.filter((e) => e.status === "overdue").length,
  };
}

export type HrTodayItem = {
  id: string;
  category: "absent" | "late" | "leave" | "joiner" | "interview" | "contract" | "birthday" | "anniversary" | "approval" | "document" | "training" | "appraisal";
  label: string;
  detail: string;
  tone: "error" | "warning" | "info" | "success" | "neutral";
  employeeId?: string;
  href: string;
};

const monthDay = (iso: string) => iso.slice(5, 10);

/** The operational "Today in HR" brief — real items from live mock state. */
export function hrTodayItems(db: Db): HrTodayItem[] {
  const today = TODAY();
  const md = monthDay(today);
  const name = (e?: Employee) => (e ? `${e.firstName} ${e.lastName}` : "Unknown");
  const items: HrTodayItem[] = [];

  for (const a of db.hrAttendance.filter((x) => x.date === today && x.status === "absent")) {
    const e = db.employees.find((x) => x.id === a.employeeId);
    items.push({ id: `abs-${a.id}`, category: "absent", label: `${name(e)} is absent`, detail: "No check-in recorded", tone: "error", employeeId: e?.id, href: e ? `/hr/staff/${e.id}` : "/hr/attendance" });
  }
  for (const a of db.hrAttendance.filter((x) => x.date === today && x.status === "late").slice(0, 4)) {
    const e = db.employees.find((x) => x.id === a.employeeId);
    items.push({ id: `late-${a.id}`, category: "late", label: `${name(e)} arrived late`, detail: `${a.lateMinutes ?? 0} min late`, tone: "warning", employeeId: e?.id, href: "/hr/attendance" });
  }
  for (const e of db.employees.filter((x) => x.status === "on-leave").slice(0, 4)) {
    items.push({ id: `leave-${e.id}`, category: "leave", label: `${name(e)} is on leave`, detail: "Approved leave", tone: "info", employeeId: e.id, href: "/hr/leave" });
  }
  for (const e of db.employees.filter((x) => x.joiningDate === today)) {
    items.push({ id: `join-${e.id}`, category: "joiner", label: `${name(e)} joins today`, detail: "New joiner — start onboarding", tone: "success", employeeId: e.id, href: "/hr/onboarding" });
  }
  for (const i of db.interviews.filter((x) => x.date === today && x.status === "scheduled")) {
    const c = db.candidates.find((x) => x.id === i.candidateId);
    items.push({ id: `intv-${i.id}`, category: "interview", label: `Interview: ${c ? c.firstName + " " + c.lastName : "candidate"}`, detail: `${i.time} · ${i.location}`, tone: "info", href: "/hr/recruitment/interviews" });
  }
  for (const c of db.contracts.filter((x) => x.status === "expiring").slice(0, 4)) {
    const e = db.employees.find((x) => x.id === c.employeeId);
    items.push({ id: `con-${c.id}`, category: "contract", label: `${name(e)}'s contract expiring`, detail: c.endDate ? `Ends ${c.endDate}` : "Renewal due", tone: "warning", employeeId: e?.id, href: "/hr/contracts" });
  }
  for (const e of db.employees.filter((x) => monthDay(x.dob) === md).slice(0, 3)) {
    items.push({ id: `bday-${e.id}`, category: "birthday", label: `${name(e)}'s birthday`, detail: "Send wishes", tone: "success", employeeId: e.id, href: `/hr/staff/${e.id}` });
  }
  for (const e of db.employees.filter((x) => monthDay(x.joiningDate) === md && x.joiningDate < today).slice(0, 3)) {
    items.push({ id: `anniv-${e.id}`, category: "anniversary", label: `${name(e)} work anniversary`, detail: "Celebrate tenure", tone: "success", employeeId: e.id, href: `/hr/staff/${e.id}` });
  }
  const pending = db.hrLeaveRequests.filter((r) => r.status === "pending").length;
  if (pending > 0) items.push({ id: "approvals", category: "approval", label: `${pending} leave approval(s) pending`, detail: "Review requests", tone: "warning", href: "/hr/leave" });
  const docExp = db.staffDocuments.filter((d) => d.status === "expiring" || d.status === "expired").length;
  if (docExp > 0) items.push({ id: "docs", category: "document", label: `${docExp} document(s) need renewal`, detail: "Verification queue", tone: "warning", href: "/hr/documents" });

  return items;
}
