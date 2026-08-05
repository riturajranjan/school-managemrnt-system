import type { DocumentRecord, DocumentStatus, DocumentType, TimelineEvent } from "@/lib/types/common";
import type {
  AdmissionApplication,
  AdmissionInterview,
  AdmissionNote,
  AdmissionSource,
  AdmissionStageKey,
  AdmissionType,
  ApplicantGuardian,
  Gender,
} from "@/lib/types/admissions";
import { firstNamesFemale, firstNamesMale } from "./names";
import { makeGuardianPair, randomLastName } from "./people";
import { CURRENT_SESSION, admissionOfficers, schoolClasses } from "./reference";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(7042026);
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

const sources: AdmissionSource[] = ["website", "walk-in", "referral", "social-media", "education-fair", "agent", "phone-enquiry"];
const admissionTypes: AdmissionType[] = ["new", "new", "new", "sibling", "transfer", "management-quota"];

function makeDocuments(applicationId: string, readiness: number): DocumentRecord[] {
  return documentTypes.map((type, index) => {
    const roll = int(0, 99) / 100;
    let status: DocumentStatus;
    if (roll < readiness * 0.55) status = "approved";
    else if (roll < readiness * 0.75) status = "under-review";
    else if (roll < readiness) status = "uploaded";
    else if (bool(0.15)) status = "re-upload-requested";
    else status = "missing";

    const uploaded = status !== "missing";
    return {
      id: `${applicationId}-doc-${index}`,
      ownerId: applicationId,
      type,
      status,
      fileName: uploaded ? `${type}.pdf` : undefined,
      sizeKb: uploaded ? int(120, 2400) : undefined,
      uploadedAt: uploaded ? daysAgoIso(int(1, 20)) : undefined,
      uploadedBy: uploaded ? "Parent portal" : undefined,
      verifiedBy: status === "approved" ? pick(admissionOfficers).name : undefined,
      verifiedAt: status === "approved" ? daysAgoIso(int(0, 10)) : undefined,
      rejectionReason: status === "re-upload-requested" ? "Document image is blurred — please re-upload a clear scan." : undefined,
      versions: uploaded
        ? [{ id: `${applicationId}-doc-${index}-v1`, fileName: `${type}.pdf`, uploadedAt: daysAgoIso(int(1, 20)), uploadedBy: "Parent portal", sizeKb: int(120, 2400) }]
        : [],
    };
  });
}

function makeTimeline(applicationId: string, stage: AdmissionStageKey, submittedDaysAgo: number): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { id: `${applicationId}-t1`, subjectId: applicationId, category: "admission", title: "Enquiry created", actorName: "Front Office", createdAt: daysAgoIso(submittedDaysAgo + 4), },
    { id: `${applicationId}-t2`, subjectId: applicationId, category: "admission", title: "Application form submitted", actorName: "Parent portal", createdAt: daysAgoIso(submittedDaysAgo) },
  ];
  const stageIndex = ["new-enquiry", "application-started", "documents-pending", "under-review", "interview-scheduled", "approved", "fee-pending", "enrolled"].indexOf(stage);
  if (stageIndex >= 2) events.push({ id: `${applicationId}-t3`, subjectId: applicationId, category: "documents", title: "Documents uploaded", actorName: "Parent portal", createdAt: daysAgoIso(submittedDaysAgo - 1) });
  if (stageIndex >= 3) events.push({ id: `${applicationId}-t4`, subjectId: applicationId, category: "admission", title: "Moved to Under review", actorName: pick(admissionOfficers).name, actorRole: "Admission Officer", createdAt: daysAgoIso(submittedDaysAgo - 2) });
  if (stageIndex >= 4) events.push({ id: `${applicationId}-t5`, subjectId: applicationId, category: "admission", title: "Interview scheduled", actorName: pick(admissionOfficers).name, actorRole: "Admission Officer", createdAt: daysAgoIso(submittedDaysAgo - 3) });
  if (stageIndex >= 5) events.push({ id: `${applicationId}-t6`, subjectId: applicationId, category: "admission", title: "Application approved", actorName: "Principal", actorRole: "Principal", createdAt: daysAgoIso(submittedDaysAgo - 4) });
  if (stageIndex >= 6) events.push({ id: `${applicationId}-t7`, subjectId: applicationId, category: "fees", title: "Admission fee invoice generated", actorName: "System", createdAt: daysAgoIso(submittedDaysAgo - 5) });
  if (stage === "rejected") events.push({ id: `${applicationId}-tr`, subjectId: applicationId, category: "admission", title: "Application rejected", actorName: "Principal", actorRole: "Principal", createdAt: daysAgoIso(submittedDaysAgo - 3) });
  if (stage === "waitlisted") events.push({ id: `${applicationId}-tw`, subjectId: applicationId, category: "admission", title: "Moved to waitlist — seat unavailable", actorName: pick(admissionOfficers).name, createdAt: daysAgoIso(submittedDaysAgo - 3) });
  return events;
}

function makeNotes(applicationId: string): AdmissionNote[] {
  if (bool(0.4)) return [];
  return [
    {
      id: `${applicationId}-note-1`,
      authorName: pick(admissionOfficers).name,
      authorRole: "Admission Officer",
      body: pick([
        "Parents requested a callback to discuss the fee structure.",
        "Sibling already enrolled in Class 6 — verify sibling discount eligibility.",
        "Follow up on pending transfer certificate before the interview.",
        "Family relocating from Chennai; previous school records requested.",
      ]),
      createdAt: daysAgoIso(int(1, 8)),
    },
  ];
}

function makeInterview(applicationId: string, stage: AdmissionStageKey): AdmissionInterview | undefined {
  if (!["interview-scheduled", "approved", "fee-pending", "enrolled", "rejected", "waitlisted"].includes(stage)) return undefined;
  const isUpcoming = stage === "interview-scheduled";
  return {
    id: `${applicationId}-interview`,
    scheduledAt: isUpcoming ? daysFromNowIso(int(1, 6)) : daysAgoIso(int(2, 10)),
    mode: pick(["in-person", "video", "phone"]),
    interviewerName: pick(["Principal", "Vice Principal", "Head of Admissions"]),
    location: "Admissions Office, Main Campus",
    status: isUpcoming ? "scheduled" : "completed",
    result: isUpcoming ? undefined : stage === "rejected" ? "not-recommended" : stage === "waitlisted" ? "waitlist" : "recommended",
    notes: isUpcoming ? undefined : "Confident, well-prepared for grade level. Good rapport with panel.",
  };
}

// Distribution of the ~26 seeded applications across the pipeline — weighted
// toward the earlier/active stages since that's where admissions staff
// spend their day, with a realistic tail of terminal outcomes.
const stagePlan: { stage: AdmissionStageKey; count: number }[] = [
  { stage: "new-enquiry", count: 4 },
  { stage: "application-started", count: 3 },
  { stage: "documents-pending", count: 4 },
  { stage: "under-review", count: 4 },
  { stage: "interview-scheduled", count: 3 },
  { stage: "approved", count: 2 },
  { stage: "fee-pending", count: 2 },
  { stage: "enrolled", count: 2 },
  { stage: "rejected", count: 1 },
  { stage: "waitlisted", count: 1 },
];

const readinessByStage: Record<AdmissionStageKey, number> = {
  "new-enquiry": 0.1,
  "application-started": 0.3,
  "documents-pending": 0.45,
  "under-review": 0.7,
  "interview-scheduled": 0.8,
  approved: 0.95,
  "fee-pending": 0.95,
  enrolled: 1,
  rejected: 0.7,
  waitlisted: 0.75,
};

export function generateAdmissionApplications(): AdmissionApplication[] {
  const applications: AdmissionApplication[] = [];
  let seq = 1;

  for (const { stage, count } of stagePlan) {
    for (let i = 0; i < count; i++) {
      const id = `app-${String(seq).padStart(3, "0")}`;
      const gender: Gender = bool(0.5) ? "male" : "female";
      const firstName = gender === "male" ? pick(firstNamesMale) : pick(firstNamesFemale);
      const lastName = randomLastName();
      const applicationNumber = `ADM-2026-${String(1000 + seq)}`;
      const appliedClass = pick(schoolClasses);
      const submittedDaysAgo = int(2, 45);
      const { father, mother } = makeGuardianPair(1000 + seq, lastName);

      const guardians: ApplicantGuardian[] = [
        {
          id: `${id}-g-father`,
          role: "father",
          firstName: father.firstName,
          lastName: father.lastName,
          occupation: father.occupation,
          organization: father.organization,
          contact: father.contact,
          address: father.address,
          isPrimary: true,
          isEmergencyContact: true,
          authorizedPickup: true,
          communicationPreference: father.communicationPreference,
        },
        {
          id: `${id}-g-mother`,
          role: "mother",
          firstName: mother.firstName,
          lastName: mother.lastName,
          occupation: mother.occupation,
          organization: mother.organization,
          contact: mother.contact,
          address: mother.address,
          isPrimary: false,
          isEmergencyContact: bool(0.6),
          authorizedPickup: true,
          communicationPreference: mother.communicationPreference,
        },
      ];

      const readiness = readinessByStage[stage];
      const documents = stage === "new-enquiry" ? [] : makeDocuments(id, readiness);
      const missingDocs = documents.filter((d) => d.status === "missing" || d.status === "re-upload-requested").length;

      const application: AdmissionApplication = {
        id,
        applicationNumber,
        session: CURRENT_SESSION,
        branchId: "main",
        draft: stage === "new-enquiry",
        stage,
        priority: missingDocs > 3 ? "high" : bool(0.3) ? "high" : bool(0.5) ? "medium" : "low",
        source: pick(sources),
        appliedClassId: appliedClass.id,
        appliedSectionPreference: bool(0.4) ? pick(appliedClass.sections).name : undefined,
        admissionType: pick(admissionTypes),
        student: {
          firstName,
          lastName,
          dob: `${2026 - appliedClass.order - 4}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`,
          gender,
          bloodGroup: pick(["A+", "B+", "O+", "AB+", "A-", "O-"]),
          nationality: "Indian",
          motherTongue: pick(["English", "Hindi", "Kannada", "Tamil", "Telugu", "Marathi"]),
        },
        guardians,
        address: father.address!,
        previousSchool:
          stage === "new-enquiry"
            ? undefined
            : {
                schoolName: pick(["Bright Future School", "St. Xavier's School", "National Public School", "Delhi Public School", "None (First school)"]),
                board: pick(["CBSE", "ICSE", "State Board"]),
                lastClassCompleted: appliedClass.name,
              },
        transport: { required: bool(0.4), routeId: undefined, pickupStop: undefined },
        hostel: { required: bool(0.08) },
        feeDetails: { applicationFeePaid: stage !== "new-enquiry", admissionFeeStructureId: undefined },
        documents,
        interview: makeInterview(id, stage),
        notes: makeNotes(id),
        payments:
          stage === "fee-pending" || stage === "enrolled"
            ? [
                {
                  id: `${id}-pay-1`,
                  label: "Admission fee",
                  amount: 15000 + appliedClass.order * 500,
                  status: stage === "enrolled" ? "paid" : "pending",
                  dueDate: stage === "fee-pending" ? daysFromNowIso(7) : undefined,
                  paidAt: stage === "enrolled" ? daysAgoIso(2) : undefined,
                  method: stage === "enrolled" ? "upi" : undefined,
                },
              ]
            : [],
        timeline: makeTimeline(id, stage, submittedDaysAgo),
        assignedOfficerId: stage === "new-enquiry" ? undefined : pick(admissionOfficers).id,
        assignedOfficerName: undefined,
        submittedAt: stage === "new-enquiry" ? undefined : daysAgoIso(submittedDaysAgo),
        createdAt: daysAgoIso(submittedDaysAgo + 4),
        updatedAt: daysAgoIso(int(0, 3)),
        formStep: stage === "new-enquiry" || stage === "application-started" ? int(1, 6) : 12,
      };

      // Resolve assignedOfficerName to the same officer as assignedOfficerId.
      if (application.assignedOfficerId) {
        application.assignedOfficerName = admissionOfficers.find((o) => o.id === application.assignedOfficerId)?.name;
      }

      applications.push(application);
      seq += 1;
    }
  }

  return applications;
}
