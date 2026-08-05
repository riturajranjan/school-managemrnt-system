import type { DocumentRecord, DocumentType, TimelineEvent } from "@/lib/types/common";
import type {
  BehaviourNote,
  Gender,
  Guardian,
  ParentAccount,
  PulseDimension,
  Student,
  StudentGuardianLink,
  StudentPulse,
} from "@/lib/types/students";
import { firstNamesFemale, firstNamesMale } from "./names";
import { makeGuardianPair, makeParentAccount, randomLastName } from "./people";
import { CURRENT_SESSION, hostelBlocks, schoolClasses, transportRoutes } from "./reference";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(19042026);
const { pick, int, bool, daysAgoIso, daysFromNowIso } = helpers;

const documentTypes: DocumentType[] = [
  "birth-certificate",
  "previous-report-card",
  "transfer-certificate",
  "address-proof",
  "identity-proof",
  "student-photo",
  "parent-identity-proof",
  "medical-record",
];

const houses = ["Aravali", "Nilgiri", "Vindhya", "Satpura"];

function scoreToTone(score: number): PulseDimension["tone"] {
  if (score >= 80) return "success";
  if (score >= 60) return "info";
  if (score >= 40) return "warning";
  return "error";
}

function makePulse(): StudentPulse {
  const dims: { key: PulseDimension["key"]; label: string }[] = [
    { key: "academics", label: "Academics" },
    { key: "attendance", label: "Attendance" },
    { key: "engagement", label: "Engagement" },
    { key: "behaviour", label: "Behaviour" },
    { key: "homework", label: "Homework" },
    { key: "wellbeing", label: "Wellbeing" },
  ];
  const dimensions: PulseDimension[] = dims.map((d) => {
    const score = int(35, 98);
    return {
      key: d.key,
      label: d.label,
      score,
      tone: scoreToTone(score),
      trend: pick(["up", "down", "flat"]),
      summary: score >= 80 ? "Consistently strong" : score >= 60 ? "Steady, on track" : score >= 40 ? "Needs monitoring" : "Requires intervention",
    };
  });
  const overallScore = Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length);
  const sorted = [...dimensions].sort((a, b) => a.score - b.score);
  const risk = sorted[0];
  const strongest = sorted[sorted.length - 1];
  const status: StudentPulse["status"] = overallScore >= 80 ? "excellent" : overallScore >= 60 ? "good" : overallScore >= 40 ? "needs-attention" : "critical";
  return {
    overallScore,
    status,
    positiveTrend: `${strongest.label} is trending strong at ${strongest.score}`,
    mainRisk: `${risk.label} is the lowest signal at ${risk.score}`,
    suggestedAction:
      risk.score < 50
        ? `Schedule a check-in focused on ${risk.label.toLowerCase()} with the class teacher and parent.`
        : `Keep monitoring ${risk.label.toLowerCase()} — no immediate action required.`,
    explanation: "Pulse blends the last 30 days of attendance, gradebook, homework, and behaviour records into six weighted dimensions.",
    dimensions,
  };
}

function makeDocuments(studentId: string): DocumentRecord[] {
  return documentTypes.map((type, index) => {
    const roll = int(0, 99);
    const status = roll < 75 ? "approved" : roll < 88 ? "under-review" : roll < 95 ? "uploaded" : "missing";
    const uploaded = status !== "missing";
    return {
      id: `${studentId}-doc-${index}`,
      ownerId: studentId,
      type,
      status,
      fileName: uploaded ? `${type}.pdf` : undefined,
      sizeKb: uploaded ? int(120, 2400) : undefined,
      uploadedAt: uploaded ? daysAgoIso(int(30, 400)) : undefined,
      uploadedBy: uploaded ? "Front office" : undefined,
      verifiedBy: status === "approved" ? "Administrator" : undefined,
      verifiedAt: status === "approved" ? daysAgoIso(int(20, 380)) : undefined,
      versions: uploaded
        ? [{ id: `${studentId}-doc-${index}-v1`, fileName: `${type}.pdf`, uploadedAt: daysAgoIso(int(30, 400)), uploadedBy: "Front office", sizeKb: int(120, 2400) }]
        : [],
    };
  });
}

function makeTimeline(studentId: string, admissionDate: string): TimelineEvent[] {
  return [
    { id: `${studentId}-t1`, subjectId: studentId, category: "admission", title: "Admitted to school", actorName: "Admissions", createdAt: admissionDate },
    { id: `${studentId}-t2`, subjectId: studentId, category: "academic", title: "Term 1 report card published", actorName: "Academics Office", createdAt: daysAgoIso(int(30, 90)) },
    { id: `${studentId}-t3`, subjectId: studentId, category: "fees", title: "Installment 2 payment received", actorName: "Accounts", createdAt: daysAgoIso(int(10, 60)) },
    ...(bool(0.3)
      ? [{ id: `${studentId}-t4`, subjectId: studentId, category: "behaviour" as const, title: "Positive note added", actorName: "Class Teacher", createdAt: daysAgoIso(int(5, 40)) }]
      : []),
  ];
}

function makeBehaviourNotes(studentId: string): BehaviourNote[] {
  if (bool(0.6)) return [];
  return [
    {
      id: `${studentId}-behaviour-1`,
      type: pick(["positive", "positive", "concern"]),
      title: pick(["Helped a classmate with homework", "Led the science fair team", "Repeated late submissions", "Disruptive during assembly"]),
      detail: "Logged by class teacher during weekly review.",
      recordedBy: "Class Teacher",
      createdAt: daysAgoIso(int(3, 60)),
    },
  ];
}

export type StudentSeedResult = {
  students: Student[];
  guardians: Guardian[];
  studentGuardianLinks: StudentGuardianLink[];
  parentAccounts: ParentAccount[];
};

export function generateStudents(count = 72): StudentSeedResult {
  const students: Student[] = [];
  const guardians: Guardian[] = [];
  const studentGuardianLinks: StudentGuardianLink[] = [];
  const parentAccounts: ParentAccount[] = [];

  for (let i = 1; i <= count; i++) {
    const gender: Gender = bool(0.5) ? "male" : "female";
    const firstName = gender === "male" ? pick(firstNamesMale) : pick(firstNamesFemale);
    const lastName = randomLastName();
    const schoolClass = pick(schoolClasses);
    const section = pick(schoolClass.sections);
    const studentId = `student-${String(i).padStart(3, "0")}`;
    const admissionDaysAgo = int(30, 900);
    const admissionDate = daysAgoIso(admissionDaysAgo);

    const { father, mother } = makeGuardianPair(2000 + i, lastName);
    guardians.push(father, mother);
    const primaryGuardianId = father.id;

    studentGuardianLinks.push(
      { studentId, guardianId: father.id, relationship: "father", isPrimary: true, isEmergencyContact: true, isAuthorizedPickup: true, isFeeResponsible: true },
      { studentId, guardianId: mother.id, relationship: "mother", isPrimary: false, isEmergencyContact: bool(0.5), isAuthorizedPickup: true, isFeeResponsible: false },
    );

    parentAccounts.push(makeParentAccount(father, i), makeParentAccount(mother, i + 1000));

    const attendancePercent = int(62, 99);
    const status: Student["status"] = bool(0.94) ? "active" : pick(["inactive", "transferred", "alumni"]);
    const feeStatusRoll = int(0, 99);
    const feeStatus = feeStatusRoll < 55 ? "paid" : feeStatusRoll < 75 ? "partial" : feeStatusRoll < 90 ? "pending" : "overdue";
    const totalDue = 42000 + schoolClass.order * 3200;
    const totalPaid = feeStatus === "paid" ? totalDue : feeStatus === "partial" ? Math.round(totalDue * 0.55) : feeStatus === "pending" ? 0 : Math.round(totalDue * 0.3);

    const hasTransport = bool(0.42);
    const route = hasTransport ? pick(transportRoutes) : undefined;
    const hasHostel = bool(0.06);
    const hostelBlock = hasHostel ? pick(hostelBlocks) : undefined;

    const student: Student = {
      id: studentId,
      admissionNumber: `NIS${2020 + Math.floor(admissionDaysAgo / 365)}${String(i).padStart(4, "0")}`,
      rollNumber: String(int(1, section.capacity)),
      profile: {
        firstName,
        lastName,
        dob: `${2026 - schoolClass.order - 4}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`,
        gender,
        bloodGroup: pick(["A+", "B+", "O+", "AB+", "A-", "O-"]),
        nationality: "Indian",
        motherTongue: pick(["English", "Hindi", "Kannada", "Tamil", "Telugu", "Marathi"]),
        house: houses[i % houses.length],
      },
      classId: schoolClass.id,
      sectionId: section.id,
      session: CURRENT_SESSION,
      branchId: "main",
      status,
      admissionDate,
      admissionType: bool(0.85) ? "new" : pick(["sibling", "transfer"]),
      address: father.address!,
      guardianIds: [father.id, mother.id],
      primaryGuardianId,
      transport: route
        ? { routeId: route.id, routeName: route.name, stopName: pick(route.stops), pickupTime: "07:15 AM", dropTime: "03:45 PM" }
        : undefined,
      hostel: hostelBlock ? { blockId: hostelBlock.id, blockName: hostelBlock.name, roomNumber: `${int(1, 4)}0${int(1, 9)}` } : undefined,
      academics: {
        overallPercent: int(48, 97),
        classRank: int(1, section.enrolledCount),
        classSize: section.enrolledCount,
        trend: pick(["up", "down", "flat"]),
        upcomingExams: [
          { id: `${studentId}-exam-1`, subject: pick(["Mathematics", "Science", "English", "Social Studies"]), date: daysFromNowIso(int(5, 25)) },
        ],
        recentHomework: [
          { id: `${studentId}-hw-1`, subject: pick(["Mathematics", "Science", "English"]), title: "Chapter review worksheet", dueDate: daysFromNowIso(int(-3, 4)), status: pick(["submitted", "submitted", "pending", "late"]) },
        ],
        subjectsAtRisk: bool(0.25) ? [pick(["Mathematics", "Science"])] : [],
      },
      attendance: {
        presentPercent: attendancePercent,
        presentDays: Math.round((attendancePercent / 100) * 180),
        absentDays: Math.round(((100 - attendancePercent) / 100) * 180 * 0.7),
        lateDays: Math.round(((100 - attendancePercent) / 100) * 180 * 0.3),
        totalDays: 180,
        todayStatus: pick(["present", "present", "present", "absent", "late", "not-marked"]),
        trend7Day: Array.from({ length: 7 }, () => int(70, 100)),
      },
      fees: {
        status: feeStatus,
        totalDue,
        totalPaid,
        overdueAmount: feeStatus === "overdue" ? totalDue - totalPaid : 0,
        nextDueDate: feeStatus !== "paid" ? daysFromNowIso(int(2, 30)) : undefined,
      },
      health: {
        bloodGroup: pick(["A+", "B+", "O+", "AB+"]),
        allergies: bool(0.15) ? [pick(["Peanuts", "Dust", "Pollen", "Lactose"])] : [],
        conditions: bool(0.08) ? [pick(["Asthma", "Mild myopia"])] : [],
        medications: [],
        emergencyContactName: `${father.firstName} ${father.lastName}`,
        emergencyContactPhone: father.contact.phone,
        lastCheckup: daysAgoIso(int(30, 200)),
      },
      behaviourNotes: makeBehaviourNotes(studentId),
      pulse: makePulse(),
      documents: makeDocuments(studentId),
      timeline: makeTimeline(studentId, admissionDate),
      createdAt: admissionDate,
      updatedAt: daysAgoIso(int(0, 10)),
    };

    students.push(student);
  }

  return { students, guardians, studentGuardianLinks, parentAccounts };
}
