import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { AdmissionApplication } from "@/lib/types/admissions";
import type { Guardian, ParentAccount, Student, StudentGuardianLink } from "@/lib/types/students";
import { findSection, schoolClasses } from "@/lib/data/seed/reference";
import { generateId } from "@/lib/utils";

export type EnrollmentInput = {
  applicationId: string;
  admissionNumber: string;
  classId: string;
  sectionId: string;
  rollNumber: string;
  joiningDate: string;
  feeStructureId?: string;
  transportRouteId?: string;
  hostelBlockId?: string;
  createParentPortal: boolean;
};

export type EnrollmentValidationResult = { valid: boolean; errors: string[] };

/** Pure so it's independently testable — takes the application + full db instead of reading the module store directly. */
export function validateEnrollment(app: AdmissionApplication, input: EnrollmentInput, db: Db): EnrollmentValidationResult {
  const errors: string[] = [];

  if (!input.admissionNumber.trim()) {
    errors.push("Admission number is required.");
  } else if (db.students.some((s) => s.admissionNumber.toLowerCase() === input.admissionNumber.trim().toLowerCase())) {
    errors.push(`Admission number "${input.admissionNumber}" is already in use.`);
  }

  if (app.convertedStudentId) {
    errors.push("This application has already been converted to a student.");
  }

  const sectionMatch = findSection(input.sectionId);
  if (!sectionMatch) {
    errors.push("Select a valid class and section.");
  } else {
    const liveEnrolled = db.students.filter((s) => s.sectionId === input.sectionId && s.status === "active").length;
    if (liveEnrolled >= sectionMatch.section.capacity) {
      errors.push(`Section ${sectionMatch.schoolClass.name}-${sectionMatch.section.name} is at capacity (${sectionMatch.section.capacity}/${sectionMatch.section.capacity}).`);
    }
  }

  if (!app.session) {
    errors.push("Application is missing an academic session.");
  }

  const requiredDocTypes = ["birth-certificate", "identity-proof", "student-photo"];
  const missingRequired = app.documents.filter((d) => requiredDocTypes.includes(d.type) && d.status !== "approved");
  if (missingRequired.length > 0) {
    errors.push(`${missingRequired.length} required document(s) are not yet approved.`);
  }

  if (!input.feeStructureId) {
    errors.push("Select a fee structure before enrolling.");
  }

  if (!app.guardians.some((g) => g.isPrimary)) {
    errors.push("Application has no primary guardian on file.");
  }

  if (!input.rollNumber.trim()) {
    errors.push("Roll number is required.");
  }

  return { valid: errors.length === 0, errors };
}

export function convertApplicationToStudent(input: EnrollmentInput): { studentId: string } | { errors: string[] } {
  const db = getSnapshot();
  const app = db.applications.find((a) => a.id === input.applicationId);
  if (!app) return { errors: ["Application not found."] };

  const result = validateEnrollment(app, input, db);
  if (!result.valid) return { errors: result.errors };

  const now = new Date().toISOString();
  const studentId = generateId("student");

  const guardians: Guardian[] = app.guardians.map((g) => ({
    id: `guardian-${studentId}-${g.role}`,
    firstName: g.firstName,
    lastName: g.lastName,
    occupation: g.occupation,
    organization: g.organization,
    contact: g.contact,
    address: g.address,
    communicationPreference: g.communicationPreference,
  }));

  const primaryApplicantGuardian = app.guardians.find((g) => g.isPrimary) ?? app.guardians[0];
  const primaryGuardian = guardians.find((_, i) => app.guardians[i]?.isPrimary) ?? guardians[0];

  const links: StudentGuardianLink[] = app.guardians.map((g, i) => ({
    studentId,
    guardianId: guardians[i].id,
    relationship: g.role,
    isPrimary: g.isPrimary,
    isEmergencyContact: g.isEmergencyContact,
    isAuthorizedPickup: g.authorizedPickup,
    isFeeResponsible: g.isPrimary,
  }));

  const parentAccounts: ParentAccount[] = input.createParentPortal
    ? guardians.map((g) => ({
        id: `parent-${g.id}`,
        guardianId: g.id,
        portalStatus: "invited" as const,
        invitedAt: now,
        loginHistory: [],
        consentForms: [],
      }))
    : [];

  const sectionMatch = findSection(input.sectionId)!;
  const transportRoute = input.transportRouteId;
  const schoolClass = schoolClasses.find((c) => c.id === input.classId);

  const student: Student = {
    id: studentId,
    admissionNumber: input.admissionNumber.trim(),
    rollNumber: input.rollNumber.trim(),
    profile: { ...app.student },
    classId: input.classId,
    sectionId: input.sectionId,
    session: app.session,
    branchId: app.branchId,
    status: "active",
    admissionDate: input.joiningDate,
    admissionType: app.admissionType === "management-quota" ? "management-quota" : app.admissionType,
    address: app.address,
    guardianIds: guardians.map((g) => g.id),
    primaryGuardianId: primaryGuardian?.id ?? guardians[0]?.id ?? "",
    transport: transportRoute
      ? { routeId: transportRoute, routeName: "Assigned route", stopName: "TBD", pickupTime: "07:15 AM", dropTime: "03:45 PM" }
      : undefined,
    hostel: input.hostelBlockId ? { blockId: input.hostelBlockId, blockName: "Assigned block", roomNumber: "TBD" } : undefined,
    academics: { overallPercent: 0, trend: "flat", upcomingExams: [], recentHomework: [], subjectsAtRisk: [] },
    attendance: { presentPercent: 100, presentDays: 0, absentDays: 0, lateDays: 0, totalDays: 0, todayStatus: "not-marked", trend7Day: [100, 100, 100, 100, 100, 100, 100] },
    fees: { status: "pending", totalDue: 0, totalPaid: 0, overdueAmount: 0, feeStructureId: input.feeStructureId },
    health: {
      emergencyContactName: primaryApplicantGuardian ? `${primaryApplicantGuardian.firstName} ${primaryApplicantGuardian.lastName}` : "",
      emergencyContactPhone: primaryApplicantGuardian?.contact.phone ?? "",
      allergies: app.medicalInfo?.allergies ? [app.medicalInfo.allergies] : [],
      conditions: app.medicalInfo?.conditions ? [app.medicalInfo.conditions] : [],
      medications: app.medicalInfo?.medications ? [app.medicalInfo.medications] : [],
    },
    behaviourNotes: [],
    pulse: {
      overallScore: 75,
      status: "good",
      positiveTrend: "New enrollment — baseline pulse not yet established",
      mainRisk: "Insufficient data",
      suggestedAction: "Pulse will populate as attendance and academic data accrues.",
      explanation: "Pulse blends the last 30 days of attendance, gradebook, homework, and behaviour records into six weighted dimensions.",
      dimensions: (["academics", "attendance", "engagement", "behaviour", "homework", "wellbeing"] as const).map((key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        score: 75,
        tone: "info",
        trend: "flat",
        summary: "New enrollment — establishing baseline",
      })),
    },
    documents: app.documents.map((d) => ({ ...d, id: `${studentId}-${d.id}`, ownerId: studentId })),
    timeline: [
      { id: generateId("evt"), subjectId: studentId, category: "admission", title: `Enrolled into ${schoolClass?.name ?? ""}-${sectionMatch.section.name}`, actorName: "Admissions", createdAt: now },
    ],
    sourceApplicationId: app.id,
    createdAt: now,
    updatedAt: now,
  };

  setState((current) => ({
    ...current,
    students: [student, ...current.students],
    guardians: [...current.guardians, ...guardians],
    studentGuardianLinks: [...current.studentGuardianLinks, ...links],
    parentAccounts: [...current.parentAccounts, ...parentAccounts],
    applications: current.applications.map((a) =>
      a.id === app.id
        ? {
            ...a,
            stage: "enrolled",
            convertedStudentId: studentId,
            updatedAt: now,
            timeline: [
              { id: generateId("evt"), subjectId: a.id, category: "admission", title: "Converted to student record", actorName: "Admissions", createdAt: now },
              ...a.timeline,
            ],
          }
        : a,
    ),
  }));

  return { studentId };
}
