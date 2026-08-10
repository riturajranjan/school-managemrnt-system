// Phase 4 development seed — real Admissions / Students / Guardians rows so the
// migrated UI reads live data through the real APIs. Deterministic + idempotent:
// entities are keyed by natural business keys (admissionNumber, guardian email,
// applicationNumber) and skipped if they already exist. No frontend duplicate
// arrays — this DB data is the single source of truth.
import type { PrismaClient } from "../lib/generated/prisma/client";
import type {
  AdmissionSource,
  AdmissionStage,
  AdmissionType,
  Gender,
  GuardianRelation,
  StudentStatus,
} from "../lib/generated/prisma/enums";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

// --- Deterministic sample vocab --------------------------------------------

const FIRST_MALE = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Kabir", "Reyansh", "Krishna", "Ishaan", "Rudra"];
const FIRST_FEMALE = ["Aadhya", "Ananya", "Diya", "Ira", "Myra", "Sara", "Anika", "Navya", "Kiara", "Riya"];
const FATHERS = ["Rajesh", "Suresh", "Vikram", "Anil", "Manoj", "Deepak", "Sanjay", "Rakesh", "Naveen", "Prakash"];
const MOTHERS = ["Sunita", "Kavita", "Meena", "Rekha", "Anita", "Poonam", "Shalini", "Neha", "Priya", "Geeta"];
const SURNAMES = ["Sharma", "Verma", "Iyer", "Nair", "Reddy", "Gupta", "Menon", "Rao", "Bose", "Khanna"];
const CLASSES = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
const SECTIONS = ["A", "B"];
const STATUSES: StudentStatus[] = ["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "INACTIVE", "ALUMNI", "TRANSFERRED", "ACTIVE"];
const ADMISSION_TYPES: AdmissionType[] = ["NEW", "TRANSFER", "SIBLING", "STAFF_WARD", "MANAGEMENT_QUOTA"];

function pad(n: number, width = 4) {
  return String(n).padStart(width, "0");
}

export async function seedPhase4(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, branchId, academicSessionId } = ids;

  // -----------------------------------------------------------------------
  // Guardians — 10 families, each with a father + mother (20 guardians).
  // -----------------------------------------------------------------------
  const guardianIdByKey = new Map<string, string>();
  for (let f = 0; f < 10; f++) {
    const surname = SURNAMES[f];
    const families: { key: string; firstName: string; lastName: string; email: string; relation: GuardianRelation; occupation: string }[] = [
      { key: `father-${f}`, firstName: FATHERS[f], lastName: surname, email: `${FATHERS[f]}.${surname}${f}@example.com`.toLowerCase(), relation: "FATHER", occupation: "Engineer" },
      { key: `mother-${f}`, firstName: MOTHERS[f], lastName: surname, email: `${MOTHERS[f]}.${surname}${f}@example.com`.toLowerCase(), relation: "MOTHER", occupation: "Doctor" },
    ];
    for (const g of families) {
      const existing = await prisma.guardian.findFirst({ where: { tenantId, email: g.email }, select: { id: true } });
      if (existing) {
        guardianIdByKey.set(g.key, existing.id);
        continue;
      }
      const created = await prisma.guardian.create({
        data: {
          tenantId,
          firstName: g.firstName,
          lastName: g.lastName,
          email: g.email,
          phone: `+91-98${pad(1000000 + f * 2 + (g.relation === "FATHER" ? 0 : 1), 8)}`,
          occupation: g.occupation,
          organization: g.relation === "FATHER" ? "Acme Corp" : "City Hospital",
          addressLine1: `${f + 1} Rosewood Lane`,
          city: "Bengaluru",
          state: "Karnataka",
          country: "IN",
          postalCode: "5600" + pad(f + 10, 2),
        },
        select: { id: true },
      });
      guardianIdByKey.set(g.key, created.id);
    }
  }

  // -----------------------------------------------------------------------
  // Students — 20, two per family (siblings share both guardians).
  // -----------------------------------------------------------------------
  let createdStudents = 0;
  for (let i = 0; i < 20; i++) {
    const family = Math.floor(i / 2);
    const admissionNumber = `NPS-STU-${pad(i + 1)}`;
    const existing = await prisma.student.findFirst({ where: { schoolId, admissionNumber }, select: { id: true } });
    if (existing) continue;

    const isMale = i % 2 === 0;
    const firstName = isMale ? FIRST_MALE[i % FIRST_MALE.length] : FIRST_FEMALE[i % FIRST_FEMALE.length];
    const lastName = SURNAMES[family];
    const gender: Gender = isMale ? "MALE" : "FEMALE";
    const classLabel = CLASSES[i % CLASSES.length];
    const sectionLabel = SECTIONS[i % SECTIONS.length];
    const status = STATUSES[i % STATUSES.length];
    const birthYear = 2010 + (i % 8);

    const student = await prisma.student.create({
      data: {
        tenantId,
        schoolId,
        branchId,
        academicSessionId,
        admissionNumber,
        rollNumber: pad((i % 40) + 1, 2),
        firstName,
        lastName,
        dateOfBirth: new Date(`${birthYear}-0${(i % 9) + 1}-15`),
        gender,
        bloodGroup: ["A+", "B+", "O+", "AB+"][i % 4],
        nationality: "Indian",
        motherTongue: ["Hindi", "Kannada", "Tamil", "Telugu"][i % 4],
        classLabel,
        sectionLabel,
        admissionDate: new Date(`2026-04-0${(i % 9) + 1}`),
        admissionType: ADMISSION_TYPES[i % ADMISSION_TYPES.length],
        status,
        addressLine1: `${family + 1} Rosewood Lane`,
        city: "Bengaluru",
        state: "Karnataka",
        country: "IN",
        postalCode: "5600" + pad(family + 10, 2),
        archivedAt: status === "ARCHIVED" ? new Date() : null,
      },
      select: { id: true },
    });
    createdStudents++;

    // Link both family guardians (father primary + fee responsible).
    const fatherId = guardianIdByKey.get(`father-${family}`);
    const motherId = guardianIdByKey.get(`mother-${family}`);
    if (fatherId) {
      await prisma.studentGuardian.create({
        data: { studentId: student.id, guardianId: fatherId, relation: "FATHER", isPrimary: true, isEmergencyContact: true, authorizedPickup: true, isFeeResponsible: true },
      });
    }
    if (motherId) {
      await prisma.studentGuardian.create({
        data: { studentId: student.id, guardianId: motherId, relation: "MOTHER", isEmergencyContact: true, authorizedPickup: true },
      });
    }

    // Document metadata (no files in Phase 4).
    await prisma.studentDocument.createMany({
      data: [
        { studentId: student.id, type: "birth-certificate", displayName: "Birth Certificate", status: "uploaded", verificationStatus: i % 3 === 0 ? "VERIFIED" : "PENDING" },
        { studentId: student.id, type: "transfer-certificate", displayName: "Transfer Certificate", status: i % 4 === 0 ? "missing" : "uploaded", verificationStatus: "PENDING" },
      ],
    });

    // Admission timeline event.
    await prisma.studentTimelineEvent.create({
      data: { studentId: student.id, type: "ADMITTED", title: "Student admitted", category: "system", actorName: "Seed" },
    });
  }

  // -----------------------------------------------------------------------
  // Admission applications — one per pipeline stage.
  // -----------------------------------------------------------------------
  const appStages: AdmissionStage[] = [
    "NEW_ENQUIRY",
    "APPLICATION_STARTED",
    "DOCUMENTS_PENDING",
    "UNDER_REVIEW",
    "INTERVIEW_SCHEDULED",
    "APPROVED",
    "FEE_PENDING",
    "REJECTED",
    "WAITLISTED",
  ];
  const appSources: AdmissionSource[] = ["WEBSITE", "WALK_IN", "REFERRAL", "SOCIAL_MEDIA", "EDUCATION_FAIR", "AGENT", "PHONE_ENQUIRY", "WEBSITE", "WALK_IN"];
  let createdApps = 0;
  for (let i = 0; i < appStages.length; i++) {
    const applicationNumber = `ADM-2026-${1000 + i}`;
    const existing = await prisma.admissionApplication.findFirst({ where: { schoolId, applicationNumber }, select: { id: true } });
    if (existing) continue;

    const stage = appStages[i];
    const isMale = i % 2 === 0;
    const firstName = isMale ? FIRST_MALE[(i + 3) % FIRST_MALE.length] : FIRST_FEMALE[(i + 3) % FIRST_FEMALE.length];
    const lastName = SURNAMES[(i + 5) % SURNAMES.length];
    const submitted = !["NEW_ENQUIRY", "APPLICATION_STARTED"].includes(stage);

    const app = await prisma.admissionApplication.create({
      data: {
        tenantId,
        schoolId,
        branchId,
        academicSessionId,
        applicationNumber,
        draft: stage === "APPLICATION_STARTED",
        stage,
        priority: ["high", "medium", "low"][i % 3],
        source: appSources[i],
        admissionType: ADMISSION_TYPES[i % ADMISSION_TYPES.length],
        appliedClass: CLASSES[i % CLASSES.length],
        appliedSectionPreference: SECTIONS[i % SECTIONS.length],
        firstName,
        lastName,
        dateOfBirth: new Date(`${2012 + (i % 6)}-0${(i % 9) + 1}-10`),
        gender: isMale ? "MALE" : "FEMALE",
        nationality: "Indian",
        email: `${firstName}.${lastName}${i}@applicants.example`.toLowerCase(),
        phone: `+91-90${pad(2000000 + i, 8)}`,
        addressLine1: `${i + 1} Maple Street`,
        city: "Bengaluru",
        state: "Karnataka",
        country: "IN",
        postalCode: "5600" + pad(i + 30, 2),
        submittedAt: submitted ? new Date("2026-05-15") : null,
        approvedAt: ["APPROVED", "FEE_PENDING"].includes(stage) ? new Date("2026-06-01") : null,
        rejectedAt: stage === "REJECTED" ? new Date("2026-06-05") : null,
        guardiansJson: [
          {
            firstName: FATHERS[(i + 2) % FATHERS.length],
            lastName,
            email: `${FATHERS[(i + 2) % FATHERS.length]}.${lastName}.app${i}@example.com`.toLowerCase(),
            phone: `+91-90${pad(3000000 + i, 8)}`,
            occupation: "Business",
            relation: "father",
            isPrimary: true,
            isEmergencyContact: true,
            authorizedPickup: true,
          },
        ],
      },
      select: { id: true, stage: true },
    });
    createdApps++;

    await prisma.admissionStageHistory.create({
      data: { applicationId: app.id, fromStage: null, toStage: stage, changedByName: "Seed", reason: "Seeded application" },
    });
    await prisma.admissionDocument.createMany({
      data: [
        { applicationId: app.id, type: "birth-certificate", displayName: "Birth Certificate", status: submitted ? "uploaded" : "missing", verificationStatus: "PENDING" },
        { applicationId: app.id, type: "photo", displayName: "Passport Photo", status: submitted ? "uploaded" : "missing", verificationStatus: "PENDING" },
      ],
    });
    if (submitted) {
      await prisma.admissionNote.create({
        data: { applicationId: app.id, authorName: "Admission Officer", authorRole: "Staff", body: "Initial screening completed.", pinned: false },
      });
    }
  }

  const [students, guardians, links, applications, docs] = await Promise.all([
    prisma.student.count({ where: { schoolId } }),
    prisma.guardian.count({ where: { tenantId } }),
    prisma.studentGuardian.count(),
    prisma.admissionApplication.count({ where: { schoolId } }),
    prisma.studentDocument.count(),
  ]);

  console.log(
    `  Phase 4:  Student=${students} (+${createdStudents}) Guardian=${guardians} Link=${links} Application=${applications} (+${createdApps}) StudentDoc=${docs}`,
  );
}
