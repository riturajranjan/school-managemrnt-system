import type { Teacher } from "@/lib/types/academics";
import type {
  Candidate,
  Contract,
  Department,
  Designation,
  Employee,
  EmployeeAssetLink,
  EmployeeStatus,
  EmployeeTimelineEvent,
  EmploymentType,
  Feedback,
  HrAnnouncement,
  HrAttendanceRecord,
  HrLeaveRequest,
  HrLeaveType,
  HrPolicy,
  Interview,
  LeaveBalance,
  OffboardingCase,
  OnboardingTask,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceReview,
  RecruitmentJob,
  Shift,
  StaffDocument,
  StaffLetter,
  TrainingCourse,
  TrainingEnrollment,
} from "@/lib/types/hr";
import { moneyFromMajor } from "@/lib/finance/money";
import { firstNamesFemale, firstNamesMale, lastNames } from "./names";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(10082026);
export const BRANCH = "main";
const TODAY = "2026-08-05";

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

const deptSeed: { name: string; code: string; tone: Department["colorTone"] }[] = [
  { name: "Administration", code: "ADM", tone: "info" },
  { name: "Academic", code: "ACA", tone: "success" },
  { name: "Finance", code: "FIN", tone: "warning" },
  { name: "Human Resources", code: "HR", tone: "info" },
  { name: "Transport", code: "TRN", tone: "neutral" },
  { name: "Library", code: "LIB", tone: "success" },
  { name: "IT", code: "IT", tone: "info" },
  { name: "Maintenance", code: "MNT", tone: "neutral" },
  { name: "Security", code: "SEC", tone: "error" },
  { name: "Admissions", code: "ADS", tone: "warning" },
];

export const departments: Department[] = deptSeed.map((d, i) => ({
  id: `dept-${i + 1}`,
  name: d.name,
  code: d.code,
  colorTone: d.tone,
  branch: BRANCH,
  budgetNote: "Managed under annual staffing budget",
  createdAt: TODAY,
}));

const deptByCode = (code: string) => departments.find((d) => d.code === code)!.id;

// ---------------------------------------------------------------------------
// Designations
// ---------------------------------------------------------------------------

const desigSeed: { title: string; code: string; dept: string; level: number; type: EmploymentType }[] = [
  { title: "Principal", code: "PRIN", dept: "ADM", level: 1, type: "permanent" },
  { title: "Vice Principal", code: "VPRIN", dept: "ADM", level: 2, type: "permanent" },
  { title: "Administrator", code: "ADMIN", dept: "ADM", level: 3, type: "permanent" },
  { title: "Receptionist", code: "RECEP", dept: "ADM", level: 5, type: "permanent" },
  { title: "Senior Teacher", code: "STEACH", dept: "ACA", level: 3, type: "permanent" },
  { title: "Teacher", code: "TEACH", dept: "ACA", level: 4, type: "permanent" },
  { title: "Visiting Faculty", code: "VFAC", dept: "ACA", level: 4, type: "visiting-faculty" },
  { title: "Accountant", code: "ACC", dept: "FIN", level: 3, type: "permanent" },
  { title: "HR Manager", code: "HRM", dept: "HR", level: 2, type: "permanent" },
  { title: "HR Executive", code: "HRE", dept: "HR", level: 4, type: "permanent" },
  { title: "Transport Manager", code: "TRNM", dept: "TRN", level: 3, type: "permanent" },
  { title: "Driver", code: "DRV", dept: "TRN", level: 5, type: "permanent" },
  { title: "Librarian", code: "LIBN", dept: "LIB", level: 3, type: "permanent" },
  { title: "IT Administrator", code: "ITA", dept: "IT", level: 3, type: "permanent" },
  { title: "Maintenance Staff", code: "MNTS", dept: "MNT", level: 5, type: "temporary" },
  { title: "Security Guard", code: "SECG", dept: "SEC", level: 5, type: "temporary" },
  { title: "Admission Officer", code: "ADSO", dept: "ADS", level: 3, type: "permanent" },
];

export const designations: Designation[] = desigSeed.map((d, i) => ({
  id: `desig-${i + 1}`,
  title: d.title,
  code: d.code,
  departmentId: deptByCode(d.dept),
  level: d.level,
  defaultEmploymentType: d.type,
  status: "active",
  createdAt: TODAY,
}));

const desigByCode = (code: string) => designations.find((d) => d.code === code)!.id;

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export const shifts: Shift[] = [
  { id: "shift-morning", name: "Morning", code: "MOR", startTime: "07:30", endTime: "13:30", breakMinutes: 30, graceMinutes: 10, lateThresholdMinutes: 15, halfDayThresholdHours: 3, days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], status: "active", createdAt: TODAY },
  { id: "shift-general", name: "General", code: "GEN", startTime: "08:30", endTime: "16:30", breakMinutes: 45, graceMinutes: 10, lateThresholdMinutes: 15, halfDayThresholdHours: 4, days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], status: "active", createdAt: TODAY },
  { id: "shift-evening", name: "Evening", code: "EVE", startTime: "13:00", endTime: "20:00", breakMinutes: 30, graceMinutes: 10, lateThresholdMinutes: 15, halfDayThresholdHours: 3.5, days: ["Mon", "Tue", "Wed", "Thu", "Fri"], status: "active", createdAt: TODAY },
  { id: "shift-night", name: "Night", code: "NGT", startTime: "20:00", endTime: "06:00", breakMinutes: 60, graceMinutes: 15, lateThresholdMinutes: 20, halfDayThresholdHours: 5, days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], status: "active", createdAt: TODAY },
];

// ---------------------------------------------------------------------------
// Employees — teaching (linked to seeded teachers) + non-teaching
// ---------------------------------------------------------------------------

const leaveTypes: HrLeaveType[] = ["casual", "sick", "earned", "compensatory"];

function makeEmployee(index: number, opts: { first: string; last: string; deptId: string; desigId: string; teaching: boolean; teacherId?: string; type: EmploymentType; gross: number; status?: EmployeeStatus }): Employee {
  const joinYearsAgo = helpers.int(0, 9);
  const joiningDate = helpers.daysAgoIso(joinYearsAgo * 365 + helpers.int(0, 300)).slice(0, 10);
  const status: EmployeeStatus = opts.status ?? (joinYearsAgo === 0 && helpers.bool(0.5) ? "probation" : helpers.bool(0.06) ? "on-leave" : "active");
  const stage = status === "probation" ? "probation" : joinYearsAgo >= 4 ? (helpers.bool(0.4) ? "growth" : "confirmed") : "confirmed";
  return {
    id: `emp-${index}`,
    employeeCode: `EMP-${String(index).padStart(4, "0")}`,
    firstName: opts.first,
    lastName: opts.last,
    photoColor: helpers.pick(["#022c43", "#18b0c8", "#0f766e", "#7c3aed", "#b45309", "#be123c", "#1d4ed8", "#047857"]),
    gender: helpers.pick(["male", "female"]),
    dob: helpers.daysAgoIso(helpers.int(24, 55) * 365).slice(0, 10),
    email: `${opts.first.toLowerCase()}.${opts.last.toLowerCase()}@novyra.edu`,
    phone: `+91 ${helpers.int(70000, 99999)} ${helpers.int(10000, 99999)}`,
    address: `${helpers.int(1, 200)}, ${helpers.pick(["MG Road", "Lake View", "Palm Meadows", "Church Street"])}, Bengaluru`,
    departmentId: opts.deptId,
    designationId: opts.desigId,
    branch: BRANCH,
    employmentType: opts.type,
    status,
    stage,
    joiningDate,
    confirmationDate: status === "probation" ? undefined : helpers.daysAgoIso(joinYearsAgo * 365 - 180).slice(0, 10),
    teacherId: opts.teacherId,
    isTeaching: opts.teaching,
    grossSalary: moneyFromMajor(opts.gross, "INR"),
    bankName: helpers.pick(["HDFC Bank", "ICICI Bank", "SBI", "Axis Bank"]),
    bankAccountMasked: `••••${helpers.int(1000, 9999)}`,
    emergencyContacts: [{ name: helpers.pick([...firstNamesMale, ...firstNamesFemale]) + " " + opts.last, relationship: helpers.pick(["Spouse", "Parent", "Sibling"]), phone: `+91 ${helpers.int(70000, 99999)} ${helpers.int(10000, 99999)}` }],
    qualifications: [{ degree: opts.teaching ? helpers.pick(["B.Ed", "M.A. B.Ed", "M.Sc B.Ed"]) : helpers.pick(["B.Com", "MBA", "B.Tech", "Diploma"]), institution: helpers.pick(["Bangalore University", "IGNOU", "Christ University"]), year: helpers.int(2005, 2020) }],
    experience: [{ organization: helpers.pick(["Delhi Public School", "Ryan International", "National Public School"]), role: "Previous role", fromYear: 2012, toYear: 2018 }],
    attendancePercent: helpers.int(82, 99),
    leaveBalanceDays: helpers.int(4, 22),
    createdAt: TODAY,
    updatedAt: TODAY,
  };
}

export function buildHrData(teachers: Teacher[]) {
  const employees: Employee[] = [];
  let idx = 0;

  // Leadership
  idx++;
  const principal = makeEmployee(idx, { first: "Rohan", last: "Kapoor", deptId: deptByCode("ADM"), desigId: desigByCode("PRIN"), teaching: false, type: "permanent", gross: 180000, status: "active" });
  employees.push(principal);
  idx++;
  employees.push(makeEmployee(idx, { first: "Priya", last: "Ramesh", deptId: deptByCode("ADM"), desigId: desigByCode("VPRIN"), teaching: false, type: "permanent", gross: 140000, status: "active" }));

  // HR
  idx++;
  const hrManager = makeEmployee(idx, { first: "Farah", last: "Sheikh", deptId: deptByCode("HR"), desigId: desigByCode("HRM"), teaching: false, type: "permanent", gross: 110000, status: "active" });
  employees.push(hrManager);
  idx++;
  employees.push(makeEmployee(idx, { first: "Kavita", last: "Nambiar", deptId: deptByCode("HR"), desigId: desigByCode("HRE"), teaching: false, type: "permanent", gross: 62000 }));

  // Teaching staff linked to seeded teachers
  const teachingDesig = desigByCode("TEACH");
  const seniorDesig = desigByCode("STEACH");
  for (const t of teachers) {
    idx++;
    const [first, ...rest] = t.name.split(" ");
    const last = rest.join(" ") || "Kumar";
    const senior = helpers.bool(0.25);
    employees.push(
      makeEmployee(idx, {
        first,
        last,
        deptId: deptByCode("ACA"),
        desigId: senior ? seniorDesig : teachingDesig,
        teaching: true,
        teacherId: t.id,
        type: helpers.bool(0.85) ? "permanent" : "fixed-term",
        gross: senior ? helpers.int(70000, 90000) : helpers.int(45000, 68000),
      }),
    );
  }

  // Non-teaching staff across departments
  const nonTeaching: { desig: string; dept: string; type: EmploymentType; gross: [number, number]; count: number }[] = [
    { desig: "ACC", dept: "FIN", type: "permanent", gross: [55000, 80000], count: 3 },
    { desig: "TRNM", dept: "TRN", type: "permanent", gross: [50000, 70000], count: 1 },
    { desig: "DRV", dept: "TRN", type: "permanent", gross: [22000, 32000], count: 6 },
    { desig: "LIBN", dept: "LIB", type: "permanent", gross: [40000, 55000], count: 2 },
    { desig: "ITA", dept: "IT", type: "permanent", gross: [55000, 75000], count: 2 },
    { desig: "MNTS", dept: "MNT", type: "temporary", gross: [18000, 26000], count: 4 },
    { desig: "SECG", dept: "SEC", type: "temporary", gross: [18000, 24000], count: 4 },
    { desig: "ADSO", dept: "ADS", type: "permanent", gross: [42000, 58000], count: 2 },
    { desig: "RECEP", dept: "ADM", type: "permanent", gross: [28000, 38000], count: 2 },
    { desig: "ADMIN", dept: "ADM", type: "permanent", gross: [40000, 55000], count: 2 },
  ];
  for (const grp of nonTeaching) {
    for (let c = 0; c < grp.count; c++) {
      idx++;
      const female = helpers.bool();
      employees.push(
        makeEmployee(idx, {
          first: helpers.pick(female ? firstNamesFemale : firstNamesMale),
          last: helpers.pick(lastNames),
          deptId: deptByCode(grp.dept),
          desigId: desigByCode(grp.desig),
          teaching: false,
          type: grp.type,
          gross: helpers.int(grp.gross[0], grp.gross[1]),
        }),
      );
    }
  }

  // Reporting: everyone → dept head → principal
  const headByDept = new Map<string, string>();
  for (const dept of departments) {
    const candidate = employees.find((e) => e.departmentId === dept.id && e.designationId !== teachingDesig && e.designationId !== desigByCode("DRV") && e.designationId !== desigByCode("MNTS") && e.designationId !== desigByCode("SECG"));
    if (candidate) {
      headByDept.set(dept.id, candidate.id);
      dept.headEmployeeId = candidate.id;
    }
  }
  for (const e of employees) {
    if (e.id === principal.id) continue;
    const head = headByDept.get(e.departmentId);
    e.reportingManagerId = head && head !== e.id ? head : principal.id;
  }

  // Contracts
  const contracts: Contract[] = employees.map((e, i) => {
    const isFixed = e.employmentType === "fixed-term" || e.employmentType === "temporary" || e.employmentType === "visiting-faculty";
    const endDate = isFixed ? helpers.daysFromNowIso(helpers.int(-20, 180)).slice(0, 10) : undefined;
    const status = e.status === "resigned" || e.status === "retired" ? "terminated" : endDate && endDate < TODAY ? "expired" : endDate && endDate < helpers.daysFromNowIso(45).slice(0, 10) ? "expiring" : "active";
    return { id: `contract-${i + 1}`, employeeId: e.id, type: e.employmentType, startDate: e.joiningDate, endDate, probationMonths: e.status === "probation" ? 6 : undefined, noticePeriodDays: e.isTeaching ? 60 : 30, workHoursPerWeek: e.employmentType === "part-time" ? 20 : 40, salary: e.grossSalary, status, createdAt: TODAY };
  });

  // Documents
  const docTypes = ["id-proof", "tax-id", "qualification", "appointment-letter", "contract"] as const;
  const documents: StaffDocument[] = [];
  employees.forEach((e, i) => {
    docTypes.forEach((type, j) => {
      const roll = helpers.rand();
      const status = roll < 0.7 ? "verified" : roll < 0.82 ? "uploaded" : roll < 0.9 ? "expiring" : roll < 0.96 ? "missing" : "expired";
      documents.push({ id: `sdoc-${i}-${j}`, employeeId: e.id, type, status, fileName: status === "missing" ? undefined : `${type}.pdf`, uploadedAt: status === "missing" ? undefined : helpers.daysAgoIso(helpers.int(30, 400)), verifiedBy: status === "verified" ? hrManager.firstName + " " + hrManager.lastName : undefined, expiryDate: type === "id-proof" ? helpers.daysFromNowIso(helpers.int(-30, 400)).slice(0, 10) : undefined });
    });
  });

  // Today's attendance + 30-day history for a subset
  const attendance: HrAttendanceRecord[] = [];
  employees.forEach((e, i) => {
    const roll = helpers.rand();
    const status = e.status === "on-leave" ? "on-leave" : roll < 0.82 ? "present" : roll < 0.9 ? "late" : roll < 0.94 ? "work-from-home" : roll < 0.97 ? "half-day" : "absent";
    attendance.push({ id: `att-${i}-today`, employeeId: e.id, date: TODAY, status, shiftId: e.isTeaching ? "shift-morning" : "shift-general", checkIn: status === "absent" || status === "on-leave" ? undefined : status === "late" ? "09:12" : "08:26", checkOut: status === "absent" || status === "on-leave" ? undefined : "16:34", workedHours: status === "present" ? 8 : status === "half-day" ? 4 : status === "late" ? 7.5 : 0, lateMinutes: status === "late" ? helpers.int(12, 45) : 0, overtimeMinutes: helpers.bool(0.1) ? helpers.int(30, 90) : 0 });
    // short history for first 20 employees
    if (i < 20) {
      for (let d = 1; d <= 14; d++) {
        const r = helpers.rand();
        const st = r < 0.85 ? "present" : r < 0.92 ? "late" : r < 0.96 ? "work-from-home" : "absent";
        attendance.push({ id: `att-${i}-${d}`, employeeId: e.id, date: helpers.daysAgoIso(d).slice(0, 10), status: st, shiftId: e.isTeaching ? "shift-morning" : "shift-general", checkIn: st === "absent" ? undefined : "08:28", checkOut: st === "absent" ? undefined : "16:30", workedHours: st === "absent" ? 0 : 8, lateMinutes: st === "late" ? helpers.int(10, 40) : 0 });
      }
    }
  });

  // Leave balances + requests
  const leaveBalances: LeaveBalance[] = employees.flatMap((e, i) =>
    leaveTypes.map((lt, j) => {
      const entitled = lt === "earned" ? 15 : lt === "casual" ? 12 : lt === "sick" ? 10 : 6;
      const used = helpers.int(0, Math.min(entitled - 1, 8));
      return { id: `lb-${i}-${j}`, employeeId: e.id, leaveType: lt, entitledDays: entitled, usedDays: used, pendingDays: helpers.bool(0.2) ? helpers.int(1, 2) : 0 };
    }),
  );

  const leaveRequests: HrLeaveRequest[] = [];
  const requesters = helpers.pickMany(employees, 22);
  requesters.forEach((e, i) => {
    const roll = helpers.rand();
    const status = roll < 0.4 ? "pending" : roll < 0.75 ? "approved" : roll < 0.88 ? "rejected" : "cancelled";
    const start = helpers.daysFromNowIso(helpers.int(-15, 20)).slice(0, 10);
    const days = helpers.int(1, 4);
    leaveRequests.push({ id: `leave-${i + 1}`, employeeId: e.id, leaveType: helpers.pick(["casual", "sick", "earned", "emergency"]), startDate: start, endDate: helpers.daysFromNowIso(helpers.int(-15, 24)).slice(0, 10) > start ? helpers.daysFromNowIso(helpers.int(-15, 24)).slice(0, 10) : start, days, halfDay: helpers.bool(0.2), reason: helpers.pick(["Family function", "Not well", "Personal work", "Medical appointment", "Travel"]), status, appliedAt: helpers.daysAgoIso(helpers.int(1, 20)), reviewerId: status !== "pending" ? hrManager.id : undefined, reviewerNote: status === "rejected" ? "Coverage unavailable" : undefined });
  });

  // Recruitment
  const jobs: RecruitmentJob[] = [
    { id: "job-1", title: "Mathematics Teacher (Secondary)", departmentId: deptByCode("ACA"), designationId: teachingDesig, branch: BRANCH, employmentType: "permanent", openings: 2, minExperienceYears: 3, qualification: "M.Sc + B.Ed", skills: ["Algebra", "Classroom management", "Assessment"], salaryMin: moneyFromMajor(45000, "INR"), salaryMax: moneyFromMajor(70000, "INR"), description: "Teach secondary mathematics and mentor students.", responsibilities: ["Deliver lessons", "Assess learning", "Parent communication"], requirements: ["B.Ed", "3+ years experience"], deadline: helpers.daysFromNowIso(20).slice(0, 10), hiringManagerId: principal.id, status: "open", createdAt: helpers.daysAgoIso(15) },
    { id: "job-2", title: "Accounts Executive", departmentId: deptByCode("FIN"), designationId: desigByCode("ACC"), branch: BRANCH, employmentType: "permanent", openings: 1, minExperienceYears: 2, qualification: "B.Com", skills: ["Tally", "GST", "Reconciliation"], salaryMin: moneyFromMajor(35000, "INR"), salaryMax: moneyFromMajor(55000, "INR"), description: "Support fee accounting and reconciliation.", responsibilities: ["Bookkeeping", "Reports"], requirements: ["B.Com", "Tally"], deadline: helpers.daysFromNowIso(12).slice(0, 10), hiringManagerId: hrManager.id, status: "open", createdAt: helpers.daysAgoIso(9) },
    { id: "job-3", title: "School Bus Driver", departmentId: deptByCode("TRN"), designationId: desigByCode("DRV"), branch: BRANCH, employmentType: "permanent", openings: 3, minExperienceYears: 3, qualification: "Valid HMV license", skills: ["Safe driving", "Route knowledge"], salaryMin: moneyFromMajor(22000, "INR"), salaryMax: moneyFromMajor(32000, "INR"), description: "Drive school routes safely.", responsibilities: ["Transport students", "Vehicle checks"], requirements: ["HMV license", "Clean record"], deadline: helpers.daysFromNowIso(30).slice(0, 10), status: "open", createdAt: helpers.daysAgoIso(20) },
    { id: "job-4", title: "IT Support Engineer", departmentId: deptByCode("IT"), designationId: desigByCode("ITA"), branch: BRANCH, employmentType: "fixed-term", openings: 1, minExperienceYears: 1, qualification: "B.Tech/Diploma", skills: ["Networking", "Windows", "Support"], salaryMin: moneyFromMajor(30000, "INR"), salaryMax: moneyFromMajor(50000, "INR"), description: "Support labs and staff systems.", responsibilities: ["Support", "Maintenance"], requirements: ["1+ years"], deadline: helpers.daysFromNowIso(18).slice(0, 10), status: "paused", createdAt: helpers.daysAgoIso(25) },
    { id: "job-5", title: "Primary Class Teacher", departmentId: deptByCode("ACA"), designationId: teachingDesig, branch: BRANCH, employmentType: "permanent", openings: 2, minExperienceYears: 2, qualification: "B.Ed", skills: ["Primary pedagogy", "Empathy"], salaryMin: moneyFromMajor(38000, "INR"), salaryMax: moneyFromMajor(58000, "INR"), description: "Teach primary grades.", responsibilities: ["Teach", "Nurture"], requirements: ["B.Ed"], deadline: helpers.daysFromNowIso(8).slice(0, 10), hiringManagerId: principal.id, status: "open", createdAt: helpers.daysAgoIso(6) },
  ];

  const stages = ["applied", "screening", "shortlisted", "interview", "assessment", "offer", "hired", "rejected"] as const;
  const candidates: Candidate[] = [];
  jobs.forEach((job, ji) => {
    const count = helpers.int(4, 9);
    for (let c = 0; c < count; c++) {
      const female = helpers.bool();
      const stage = helpers.pick(stages);
      candidates.push({ id: `cand-${ji + 1}-${c + 1}`, jobId: job.id, firstName: helpers.pick(female ? firstNamesFemale : firstNamesMale), lastName: helpers.pick(lastNames), email: `candidate${ji}${c}@example.com`, phone: `+91 ${helpers.int(70000, 99999)} ${helpers.int(10000, 99999)}`, experienceYears: helpers.int(0, 12), qualification: helpers.pick(["B.Ed", "M.Sc B.Ed", "B.Com", "MBA", "B.Tech"]), source: helpers.pick(["referral", "job-portal", "walk-in", "agency", "website"]), stage, score: stage === "applied" ? undefined : helpers.int(55, 95), ownerId: hrManager.id, appliedAt: helpers.daysAgoIso(helpers.int(2, 40)), notes: undefined });
    }
  });

  const interviews: Interview[] = [];
  candidates.filter((c) => c.stage === "interview" || c.stage === "assessment" || c.stage === "offer").slice(0, 14).forEach((c, i) => {
    interviews.push({ id: `intv-${i + 1}`, candidateId: c.id, jobId: c.jobId, type: helpers.pick(["screening", "technical", "teaching-demo", "hr", "principal-round", "final"]), date: helpers.daysFromNowIso(helpers.int(-3, 10)).slice(0, 10), time: helpers.pick(["10:00", "11:30", "14:00", "15:30"]), durationMinutes: helpers.pick([30, 45, 60]), interviewerIds: [principal.id, hrManager.id], location: helpers.pick(["Conference Room A", "Principal Office", "Online"]), videoLink: helpers.bool(0.4) ? "https://meet.example.com/interview" : undefined, status: helpers.pick(["scheduled", "scheduled", "completed"]), rating: helpers.bool(0.5) ? helpers.int(3, 5) : undefined });
  });

  // Onboarding — for probation/new employees
  const onboardingTasks: OnboardingTask[] = [];
  const onboardingLabels: { label: string; category: OnboardingTask["category"] }[] = [
    { label: "Documents uploaded", category: "documents" },
    { label: "Offer accepted", category: "documents" },
    { label: "Contract signed", category: "documents" },
    { label: "Employee ID assigned", category: "access" },
    { label: "Department assigned", category: "access" },
    { label: "Manager assigned", category: "access" },
    { label: "Payroll & bank details", category: "compliance" },
    { label: "Email / system access", category: "access" },
    { label: "ID card issued", category: "assets" },
    { label: "Assets assigned", category: "assets" },
    { label: "Orientation completed", category: "orientation" },
    { label: "Policy acknowledgement", category: "compliance" },
    { label: "Initial training", category: "orientation" },
  ];
  employees.filter((e) => e.status === "probation").forEach((e, ei) => {
    const progressCut = helpers.int(4, 11);
    onboardingLabels.forEach((task, ti) => {
      onboardingTasks.push({ id: `onb-${ei}-${ti}`, employeeId: e.id, label: task.label, category: task.category, completed: ti < progressCut, completedAt: ti < progressCut ? helpers.daysAgoIso(helpers.int(1, 20)) : undefined });
    });
  });

  // Offboarding — a couple of cases
  const exiting = helpers.pickMany(employees.filter((e) => e.status === "active" && !e.isTeaching), 2);
  const offboarding: OffboardingCase[] = exiting.map((e, i) => ({
    id: `off-${i + 1}`,
    employeeId: e.id,
    resignationDate: helpers.daysAgoIso(helpers.int(5, 25)).slice(0, 10),
    lastWorkingDate: helpers.daysFromNowIso(helpers.int(10, 40)).slice(0, 10),
    reason: helpers.pick(["Better opportunity", "Relocation", "Higher studies"]),
    status: helpers.pick(["notice-period", "clearance-pending"]),
    clearances: [
      { key: "handover", label: "Work handover", cleared: helpers.bool(0.6) },
      { key: "assets", label: "Assets returned", cleared: helpers.bool(0.5) },
      { key: "library", label: "Library clearance", cleared: helpers.bool(0.7) },
      { key: "finance", label: "Finance clearance", cleared: helpers.bool(0.4) },
      { key: "transport", label: "Transport clearance", cleared: helpers.bool(0.8) },
      { key: "access", label: "Access removal", cleared: false },
    ],
    exitInterviewDone: helpers.bool(0.3),
    createdAt: TODAY,
  }));
  exiting.forEach((e) => (e.status = "notice-period"));

  // Performance
  const cycles: PerformanceCycle[] = [
    { id: "cycle-annual", name: "Annual Appraisal 2025–26", type: "annual", startDate: "2026-04-01", endDate: "2026-09-30", status: "active", createdAt: TODAY },
    { id: "cycle-probation", name: "Probation Reviews Q2", type: "probation", startDate: "2026-07-01", endDate: "2026-09-30", status: "active", createdAt: TODAY },
    { id: "cycle-observation", name: "Teacher Observation Round 1", type: "teacher-observation", startDate: "2026-08-01", endDate: "2026-10-31", status: "active", createdAt: TODAY },
  ];
  const teacherCriteria = [
    { key: "teaching-quality", label: "Teaching quality" },
    { key: "student-engagement", label: "Student engagement" },
    { key: "curriculum-delivery", label: "Curriculum delivery" },
    { key: "collaboration", label: "Collaboration" },
    { key: "professional-development", label: "Professional development" },
  ];
  const reviewStagesArr = ["self-review", "manager-review", "reviewer", "hr", "final-discussion", "completed"] as const;
  const reviews: PerformanceReview[] = helpers.pickMany(employees, 30).map((e, i) => {
    const stage = helpers.pick(reviewStagesArr);
    return { id: `review-${i + 1}`, cycleId: e.status === "probation" ? "cycle-probation" : e.isTeaching ? "cycle-observation" : "cycle-annual", employeeId: e.id, reviewerId: e.reportingManagerId, stage, criteria: teacherCriteria.map((c) => ({ ...c, rating: stage === "self-review" ? undefined : helpers.int(3, 5), comment: undefined })), strengths: stage === "completed" ? "Consistent, reliable, student-focused." : undefined, developmentAreas: stage === "completed" ? "Explore more digital tools." : undefined, overallRating: stage === "completed" ? helpers.int(3, 5) : undefined, updatedAt: helpers.daysAgoIso(helpers.int(1, 30)) };
  });

  const goals: PerformanceGoal[] = helpers.pickMany(employees, 24).map((e, i) => {
    const progress = helpers.int(0, 100);
    const status = progress >= 100 ? "completed" : progress < 30 && helpers.bool(0.4) ? "at-risk" : "active";
    return { id: `goal-${i + 1}`, employeeId: e.id, title: helpers.pick(["Improve class average by 8%", "Complete child-protection training", "Digitise lesson plans", "Mentor two junior staff", "Reduce late submissions"]), category: e.isTeaching ? helpers.pick(["teaching", "student-outcomes", "professional-development"]) : helpers.pick(["administrative", "professional-development"]), startDate: "2026-04-01", dueDate: "2026-09-30", progress, keyResults: [{ label: "Milestone 1", done: progress > 33 }, { label: "Milestone 2", done: progress > 66 }, { label: "Milestone 3", done: progress >= 100 }], status };
  });

  const feedback: Feedback[] = helpers.pickMany(employees, 18).flatMap((e, i) =>
    (["manager", "peer", "department-head"] as const).slice(0, helpers.int(1, 3)).map((source, j) => ({ id: `fb-${i}-${j}`, employeeId: e.id, cycleId: "cycle-annual", source, fromMasked: source === "manager" ? "Reporting manager" : source === "peer" ? "Peer (anonymous)" : "Department head", rating: helpers.int(3, 5), comment: helpers.pick(["Collaborative and dependable.", "Strong subject knowledge.", "Could delegate more.", "Great with students.", "Very organised."]), submittedAt: helpers.daysAgoIso(helpers.int(2, 30)) })),
  );

  // Training
  const courses: TrainingCourse[] = [
    { id: "course-1", name: "Child Protection & Safeguarding", category: "child-protection", trainer: "External Consultant", deliveryType: "in-person", durationHours: 6, startDate: helpers.daysFromNowIso(5).slice(0, 10), endDate: helpers.daysFromNowIso(5).slice(0, 10), capacity: 40, mandatory: true, description: "Mandatory safeguarding training for all staff.", hasCertificate: true, status: "scheduled", createdAt: TODAY },
    { id: "course-2", name: "Digital Classroom Tools", category: "technology", trainer: "IT Team", deliveryType: "hybrid", durationHours: 4, startDate: helpers.daysAgoIso(3).slice(0, 10), endDate: helpers.daysFromNowIso(1).slice(0, 10), capacity: 30, mandatory: false, description: "Use smart boards and LMS effectively.", hasCertificate: true, status: "in-progress", createdAt: TODAY },
    { id: "course-3", name: "First Aid & Emergency Response", category: "safety", trainer: "Red Cross", deliveryType: "in-person", durationHours: 8, startDate: helpers.daysAgoIso(30).slice(0, 10), endDate: helpers.daysAgoIso(30).slice(0, 10), capacity: 25, mandatory: true, description: "Basic first-aid certification.", hasCertificate: true, status: "completed", createdAt: TODAY },
    { id: "course-4", name: "Inclusive Teaching Practices", category: "teaching-methodology", trainer: "Academic Head", deliveryType: "online", durationHours: 5, startDate: helpers.daysFromNowIso(14).slice(0, 10), endDate: helpers.daysFromNowIso(14).slice(0, 10), capacity: 50, mandatory: false, description: "Differentiated instruction strategies.", hasCertificate: false, status: "scheduled", createdAt: TODAY },
    { id: "course-5", name: "Leadership for Coordinators", category: "leadership", trainer: "External Consultant", deliveryType: "in-person", durationHours: 12, startDate: helpers.daysFromNowIso(25).slice(0, 10), endDate: helpers.daysFromNowIso(26).slice(0, 10), capacity: 15, mandatory: false, description: "Team leadership fundamentals.", hasCertificate: true, status: "draft", createdAt: TODAY },
  ];
  const enrollments: TrainingEnrollment[] = [];
  courses.forEach((course, ci) => {
    const enrolled = helpers.pickMany(employees, helpers.int(8, 20));
    enrolled.forEach((e, i) => {
      const status = course.status === "completed" ? (helpers.bool(0.85) ? "completed" : "overdue") : course.status === "in-progress" ? "in-progress" : "enrolled";
      enrollments.push({ id: `enr-${ci}-${i}`, courseId: course.id, employeeId: e.id, status, progress: status === "completed" ? 100 : status === "in-progress" ? helpers.int(20, 80) : 0, completedAt: status === "completed" ? helpers.daysAgoIso(helpers.int(1, 25)) : undefined, certificateIssued: status === "completed" && course.hasCertificate });
    });
  });

  // Assets, timelines, letters
  const assetLinks: EmployeeAssetLink[] = helpers.pickMany(employees, 24).map((e, i) => ({ id: `empasset-${i}`, employeeId: e.id, assetName: helpers.pick(["Dell Latitude Laptop", "Epson Projector", "ID Card", "Access Fob", "Desk Phone"]), assetTag: `AST-${String(helpers.int(1, 12)).padStart(4, "0")}`, assignedAt: helpers.daysAgoIso(helpers.int(20, 300)) }));

  const timelines: EmployeeTimelineEvent[] = employees.flatMap((e, i) => {
    const events: EmployeeTimelineEvent[] = [{ id: `tl-${i}-join`, employeeId: e.id, type: "joining", title: "Joined the school", detail: `As ${designations.find((d) => d.id === e.designationId)?.title}`, date: e.joiningDate }];
    if (e.confirmationDate) events.push({ id: `tl-${i}-conf`, employeeId: e.id, type: "confirmation", title: "Confirmed", date: e.confirmationDate });
    if (helpers.bool(0.4)) events.push({ id: `tl-${i}-appr`, employeeId: e.id, type: "appraisal", title: "Annual appraisal completed", date: helpers.daysAgoIso(helpers.int(120, 300)).slice(0, 10) });
    if (helpers.bool(0.2)) events.push({ id: `tl-${i}-prom`, employeeId: e.id, type: "promotion", title: "Promoted", detail: "Recognised for strong performance", date: helpers.daysAgoIso(helpers.int(200, 600)).slice(0, 10) });
    if (helpers.bool(0.3)) events.push({ id: `tl-${i}-train`, employeeId: e.id, type: "training", title: "Completed training", date: helpers.daysAgoIso(helpers.int(30, 200)).slice(0, 10) });
    return events;
  });

  const letters: StaffLetter[] = helpers.pickMany(employees, 8).map((e, i) => ({ id: `letter-${i}`, employeeId: e.id, type: helpers.pick(["appointment", "experience", "salary-certificate", "employment-certificate"]), generatedAt: helpers.daysAgoIso(helpers.int(5, 120)), generatedBy: hrManager.firstName + " " + hrManager.lastName }));

  const announcements: HrAnnouncement[] = [
    { id: "ann-1", title: "Mandatory Safeguarding Training", body: "All staff must complete the Child Protection & Safeguarding session by month-end.", audience: "all-staff", pinned: true, publishedAt: helpers.daysAgoIso(2) },
    { id: "ann-2", title: "Revised Leave Policy", body: "Earned-leave carry-forward is now capped at 30 days. See the policy library.", audience: "all-staff", pinned: false, publishedAt: helpers.daysAgoIso(6) },
    { id: "ann-3", title: "Staff Wellness Week", body: "Wellness activities and health check-ups next week for teaching staff.", audience: "teaching", pinned: false, publishedAt: helpers.daysAgoIso(9) },
  ];

  const policies: HrPolicy[] = [
    { id: "pol-1", title: "Leave & Attendance Policy", category: "leave", summary: "Leave types, accrual, application and approval workflow.", updatedAt: helpers.daysAgoIso(40), version: "v3.1" },
    { id: "pol-2", title: "Code of Conduct", category: "conduct", summary: "Professional standards and behaviour expectations.", updatedAt: helpers.daysAgoIso(120), version: "v2.0" },
    { id: "pol-3", title: "Child Protection Policy", category: "safety", summary: "Safeguarding responsibilities and reporting.", updatedAt: helpers.daysAgoIso(20), version: "v4.0" },
    { id: "pol-4", title: "IT & Acceptable Use", category: "it", summary: "System access, data handling and device usage.", updatedAt: helpers.daysAgoIso(85), version: "v1.4" },
    { id: "pol-5", title: "Grievance Redressal", category: "general", summary: "How to raise and resolve workplace concerns.", updatedAt: helpers.daysAgoIso(200), version: "v1.1" },
  ];

  return { employees, contracts, documents, attendance, leaveBalances, leaveRequests, jobs, candidates, interviews, onboardingTasks, offboarding, cycles, reviews, goals, feedback, courses, enrollments, assetLinks, timelines, letters, announcements, policies };
}
