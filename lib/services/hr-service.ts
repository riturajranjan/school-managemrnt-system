import { getSnapshot, setState } from "@/lib/data/store";
import type {
  CandidateStage,
  Employee,
  EmployeeStatus,
  HrAttendanceStatus,
  HrLeaveRequest,
  HrLeaveType,
  Interview,
  InterviewType,
  LetterType,
} from "@/lib/types/hr";
import { moneyFromMajor } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1);
}

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------

export function applyLeave(input: { employeeId: string; leaveType: HrLeaveType; startDate: string; endDate: string; halfDay: boolean; reason: string; contactDuringLeave?: string }): Result & { request?: HrLeaveRequest } {
  if (!input.reason.trim()) return { ok: false, error: "A reason is required." };
  if (input.endDate < input.startDate) return { ok: false, error: "End date cannot be before start date." };
  const days = input.halfDay ? 0.5 : daysBetween(input.startDate, input.endDate);
  const now = new Date().toISOString();
  const request: HrLeaveRequest = { id: generateId("leave"), employeeId: input.employeeId, leaveType: input.leaveType, startDate: input.startDate, endDate: input.endDate, days, halfDay: input.halfDay, reason: input.reason.trim(), contactDuringLeave: input.contactDuringLeave, status: "pending", appliedAt: now };
  setState((db) => ({ ...db, hrLeaveRequests: [request, ...db.hrLeaveRequests] }));
  return { ok: true, request };
}

export function reviewLeave(requestId: string, decision: "approved" | "rejected", reviewerId: string, note?: string): Result {
  const db = getSnapshot();
  const req = db.hrLeaveRequests.find((r) => r.id === requestId);
  if (!req) return { ok: false, error: "Leave request not found." };
  if (req.status !== "pending") return { ok: false, error: "Only pending requests can be reviewed." };
  const now = new Date().toISOString();
  setState((current) => ({
    ...current,
    hrLeaveRequests: current.hrLeaveRequests.map((r) => (r.id === requestId ? { ...r, status: decision, reviewerId, reviewerNote: note, reviewedAt: now } : r)),
    // On approval, reflect against the matching leave balance.
    leaveBalances: decision === "approved" ? current.leaveBalances.map((b) => (b.employeeId === req.employeeId && b.leaveType === req.leaveType ? { ...b, usedDays: b.usedDays + req.days } : b)) : current.leaveBalances,
  }));
  return { ok: true };
}

export function cancelLeave(requestId: string): Result {
  const db = getSnapshot();
  const req = db.hrLeaveRequests.find((r) => r.id === requestId);
  if (!req) return { ok: false, error: "Leave request not found." };
  setState((current) => ({ ...current, hrLeaveRequests: current.hrLeaveRequests.map((r) => (r.id === requestId ? { ...r, status: "cancelled" } : r)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export function setAttendanceStatus(employeeId: string, date: string, status: HrAttendanceStatus): Result {
  const db = getSnapshot();
  const existing = db.hrAttendance.find((a) => a.employeeId === employeeId && a.date === date);
  setState((current) => {
    if (existing) return { ...current, hrAttendance: current.hrAttendance.map((a) => (a.id === existing.id ? { ...a, status } : a)) };
    return { ...current, hrAttendance: [{ id: generateId("att"), employeeId, date, status }, ...current.hrAttendance] };
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Onboarding / offboarding
// ---------------------------------------------------------------------------

export function toggleOnboardingTask(taskId: string): Result {
  const db = getSnapshot();
  const task = db.onboardingTasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, error: "Task not found." };
  const now = new Date().toISOString();
  setState((current) => ({ ...current, onboardingTasks: current.onboardingTasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed, completedAt: !t.completed ? now : undefined } : t)) }));
  return { ok: true };
}

export function toggleClearance(caseId: string, key: string): Result {
  const db = getSnapshot();
  const c = db.offboardingCases.find((x) => x.id === caseId);
  if (!c) return { ok: false, error: "Case not found." };
  setState((current) => ({ ...current, offboardingCases: current.offboardingCases.map((x) => (x.id === caseId ? { ...x, clearances: x.clearances.map((cl) => (cl.key === key ? { ...cl, cleared: !cl.cleared } : cl)) } : x)) }));
  return { ok: true };
}

export function startOffboarding(input: { employeeId: string; resignationDate: string; lastWorkingDate: string; reason: string }): Result {
  const db = getSnapshot();
  if (db.offboardingCases.some((c) => c.employeeId === input.employeeId && c.status !== "completed")) return { ok: false, error: "An active offboarding case already exists for this employee." };
  const now = new Date().toISOString();
  setState((current) => ({
    ...current,
    offboardingCases: [
      { id: generateId("off"), employeeId: input.employeeId, resignationDate: input.resignationDate, lastWorkingDate: input.lastWorkingDate, reason: input.reason, status: "initiated", clearances: [
        { key: "handover", label: "Work handover", cleared: false },
        { key: "assets", label: "Assets returned", cleared: false },
        { key: "library", label: "Library clearance", cleared: false },
        { key: "finance", label: "Finance clearance", cleared: false },
        { key: "transport", label: "Transport clearance", cleared: false },
        { key: "access", label: "Access removal", cleared: false },
      ], exitInterviewDone: false, createdAt: now },
      ...current.offboardingCases,
    ],
    employees: current.employees.map((e) => (e.id === input.employeeId ? { ...e, status: "notice-period" } : e)),
  }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Recruitment
// ---------------------------------------------------------------------------

export function moveCandidateStage(candidateId: string, stage: CandidateStage): Result {
  const db = getSnapshot();
  const candidate = db.candidates.find((c) => c.id === candidateId);
  if (!candidate) return { ok: false, error: "Candidate not found." };
  setState((current) => ({ ...current, candidates: current.candidates.map((c) => (c.id === candidateId ? { ...c, stage } : c)) }));
  return { ok: true };
}

export function scheduleInterview(input: { candidateId: string; jobId: string; type: InterviewType; date: string; time: string; interviewerIds: string[]; location: string; videoLink?: string }): Result & { interview?: Interview } {
  const interview: Interview = { id: generateId("intv"), candidateId: input.candidateId, jobId: input.jobId, type: input.type, date: input.date, time: input.time, durationMinutes: 45, interviewerIds: input.interviewerIds, location: input.location, videoLink: input.videoLink, status: "scheduled" };
  setState((db) => ({ ...db, interviews: [interview, ...db.interviews], candidates: db.candidates.map((c) => (c.id === input.candidateId && (c.stage === "shortlisted" || c.stage === "screening") ? { ...c, stage: "interview" } : c)) }));
  return { ok: true, interview };
}

/** Converts a hired candidate into an employee record (frontend mock). */
export function convertCandidateToEmployee(candidateId: string): Result & { employee?: Employee } {
  const db = getSnapshot();
  const candidate = db.candidates.find((c) => c.id === candidateId);
  if (!candidate) return { ok: false, error: "Candidate not found." };
  const job = db.recruitmentJobs.find((j) => j.id === candidate.jobId);
  const now = new Date().toISOString();
  const code = `EMP-${String(db.employees.length + 1).padStart(4, "0")}`;
  const employee: Employee = {
    id: generateId("emp"),
    employeeCode: code,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    photoColor: "#18b0c8",
    gender: "other",
    dob: "1990-01-01",
    email: candidate.email,
    phone: candidate.phone,
    address: "",
    departmentId: job?.departmentId ?? db.departments[0]?.id ?? "dept-1",
    designationId: job?.designationId ?? db.designations[0]?.id ?? "desig-1",
    branch: job?.branch ?? "main",
    employmentType: job?.employmentType ?? "probation",
    status: "probation",
    stage: "joined",
    joiningDate: now.slice(0, 10),
    isTeaching: false,
    grossSalary: job?.salaryMin ?? moneyFromMajor(30000, "INR"),
    emergencyContacts: [],
    qualifications: [{ degree: candidate.qualification, institution: "—", year: 2015 }],
    experience: [],
    attendancePercent: 100,
    leaveBalanceDays: 0,
    createdAt: now,
    updatedAt: now,
  };
  setState((current) => ({
    ...current,
    employees: [employee, ...current.employees],
    candidates: current.candidates.map((c) => (c.id === candidateId ? { ...c, stage: "hired" } : c)),
    employeeTimeline: [{ id: generateId("tl"), employeeId: employee.id, type: "joining", title: "Joined the school", detail: `Hired for ${job?.title ?? "role"}`, date: now.slice(0, 10) }, ...current.employeeTimeline],
  }));
  return { ok: true, employee };
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export type EmployeeDraft = Omit<Employee, "id" | "employeeCode" | "stage" | "createdAt" | "updatedAt">;

export function createEmployee(draft: EmployeeDraft): Result & { employee?: Employee } {
  if (!draft.firstName.trim()) return { ok: false, error: "First name is required." };
  const db = getSnapshot();
  const now = new Date().toISOString();
  const employee: Employee = { ...draft, id: generateId("emp"), employeeCode: `EMP-${String(db.employees.length + 1).padStart(4, "0")}`, stage: draft.status === "probation" ? "probation" : "joined", createdAt: now, updatedAt: now };
  setState((current) => ({ ...current, employees: [employee, ...current.employees], employeeTimeline: [{ id: generateId("tl"), employeeId: employee.id, type: "joining", title: "Joined the school", date: now.slice(0, 10) }, ...current.employeeTimeline] }));
  return { ok: true, employee };
}

export function updateEmployee(employeeId: string, patch: Partial<EmployeeDraft>): Result {
  const db = getSnapshot();
  if (!db.employees.some((e) => e.id === employeeId)) return { ok: false, error: "Employee not found." };
  const now = new Date().toISOString();
  setState((current) => ({ ...current, employees: current.employees.map((e) => (e.id === employeeId ? { ...e, ...patch, updatedAt: now } : e)) }));
  return { ok: true };
}

export function setEmployeeStatus(employeeId: string, status: EmployeeStatus): Result {
  return updateEmployee(employeeId, { status });
}

export function addTimelineNote(employeeId: string, title: string, detail?: string): Result {
  if (!title.trim()) return { ok: false, error: "Note title is required." };
  const now = new Date().toISOString();
  setState((db) => ({ ...db, employeeTimeline: [{ id: generateId("tl"), employeeId, type: "note", title: title.trim(), detail, date: now.slice(0, 10) }, ...db.employeeTimeline] }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Performance & training
// ---------------------------------------------------------------------------

export function updateGoalProgress(goalId: string, progress: number): Result {
  const db = getSnapshot();
  const goal = db.performanceGoals.find((g) => g.id === goalId);
  if (!goal) return { ok: false, error: "Goal not found." };
  const clamped = Math.max(0, Math.min(100, progress));
  setState((current) => ({ ...current, performanceGoals: current.performanceGoals.map((g) => (g.id === goalId ? { ...g, progress: clamped, status: clamped >= 100 ? "completed" : clamped < 30 ? "at-risk" : "active" } : g)) }));
  return { ok: true };
}

export function advanceReviewStage(reviewId: string): Result {
  const db = getSnapshot();
  const review = db.performanceReviews.find((r) => r.id === reviewId);
  if (!review) return { ok: false, error: "Review not found." };
  const order = ["self-review", "manager-review", "reviewer", "hr", "final-discussion", "completed"] as const;
  const next = order[Math.min(order.indexOf(review.stage) + 1, order.length - 1)];
  const now = new Date().toISOString();
  setState((current) => ({ ...current, performanceReviews: current.performanceReviews.map((r) => (r.id === reviewId ? { ...r, stage: next, updatedAt: now } : r)) }));
  return { ok: true };
}

export function enrollInTraining(courseId: string, employeeId: string): Result {
  const db = getSnapshot();
  if (db.trainingEnrollments.some((e) => e.courseId === courseId && e.employeeId === employeeId)) return { ok: false, error: "Already enrolled." };
  setState((current) => ({ ...current, trainingEnrollments: [{ id: generateId("enr"), courseId, employeeId, status: "enrolled", progress: 0, certificateIssued: false }, ...current.trainingEnrollments] }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Letters
// ---------------------------------------------------------------------------

export function generateLetter(employeeId: string, type: LetterType, generatedBy: string): Result {
  const now = new Date().toISOString();
  setState((db) => ({ ...db, staffLetters: [{ id: generateId("letter"), employeeId, type, generatedAt: now, generatedBy }, ...db.staffLetters] }));
  return { ok: true };
}
