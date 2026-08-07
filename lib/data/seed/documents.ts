import type { Student } from "@/lib/types/students";
import type { Teacher } from "@/lib/types/academics";
import type { Employee } from "@/lib/types/hr";
import type {
  DocumentBatch,
  DocumentBatchItem,
  DocumentNumberingRule,
  DocumentStatus,
  DocumentTemplate,
  DocumentType,
  DocumentVersion,
  GeneratedDocument,
  IdCardRecord,
  IdCardStyle,
  PrintQueueItem,
  SignatoryProfile,
  TemplateSection,
  TemplateSectionType,
  VerificationRecord,
} from "@/lib/types/documents";
import { findClass, findSection } from "./reference";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(12122026);

export const DOC_BRANDING = {
  name: "Novyra Public School",
  address: "12 Vidya Marg, Sector 21, Gurugram, Haryana 122001",
  contact: "+91 124 400 1200 · office@novyra.edu.in",
  website: "www.novyra.edu.in",
  session: "2026-2027",
  registration: "Affiliation No. 000/2015 (placeholder)",
};

function daysAgo(n: number) { return helpers.daysAgoIso(n).slice(0, 10); }
function daysFromNow(n: number) { return helpers.daysFromNowIso(n).slice(0, 10); }
function isoTime(hoursAgo: number) { const d = new Date("2026-08-08T11:00:00Z"); d.setHours(d.getHours() - hoursAgo); return d.toISOString(); }

let tokenSeq = 5000;
function token() { tokenSeq += 1; return `NVX-${(tokenSeq * 2654435761 % 1_000_000_000).toString(36).toUpperCase()}`; }

function section(type: TemplateSectionType, order: number, over: Partial<TemplateSection> = {}): TemplateSection {
  return { id: `sec-${type}-${order}`, type, label: over.label ?? type, show: over.show ?? true, align: over.align ?? "left", fontSize: over.fontSize ?? "sm", fontWeight: over.fontWeight ?? "normal", color: over.color, order, customText: over.customText };
}

export function buildDocumentsData(students: Student[], teachers: Teacher[], employees: Employee[]) {
  const studentName = (s: Student) => `${s.profile.firstName} ${s.profile.lastName}`;
  const classLabel = (s: Student) => { const c = findClass(s.classId); const sec = findSection(s.sectionId)?.section; return c ? `${c.name}${sec ? ` · ${sec.name}` : ""}` : "—"; };
  const activeStudents = students.filter((s) => s.status === "active");
  const staff = employees.length ? employees : [];

  // -------------------------------------------------------------------------
  // Numbering rules & signatories
  // -------------------------------------------------------------------------
  const numberingRules: DocumentNumberingRule[] = [
    { id: "num-tc", name: "Transfer Certificate", docTypes: ["transfer-certificate"], prefix: "TC", includeYear: true, branchCode: undefined, separator: "/", sequenceLength: 4, nextSequence: 42 },
    { id: "num-bon", name: "Bonafide Certificate", docTypes: ["bonafide-certificate", "study-certificate", "conduct-certificate", "character-certificate"], prefix: "BON", includeYear: true, separator: "/", sequenceLength: 4, nextSequence: 121 },
    { id: "num-idstu", name: "Student ID", docTypes: ["student-id"], prefix: "ID/STU", includeYear: true, separator: "/", sequenceLength: 3, nextSequence: 233 },
    { id: "num-idstaff", name: "Staff ID", docTypes: ["staff-id"], prefix: "ID/STF", includeYear: true, separator: "/", sequenceLength: 3, nextSequence: 61 },
    { id: "num-exp", name: "Experience / Staff Letters", docTypes: ["experience-letter", "relieving-letter", "salary-certificate", "employment-certificate", "appointment-letter", "offer-letter"], prefix: "EXP/STAFF", includeYear: true, separator: "/", sequenceLength: 3, nextSequence: 18 },
    { id: "num-adm", name: "Admit Card", docTypes: ["admit-card"], prefix: "ADM", includeYear: true, separator: "-", sequenceLength: 4, nextSequence: 310 },
  ];

  const signatories: SignatoryProfile[] = [
    { id: "sig-principal", name: "Dr. Meera Krishnan", designation: "Principal", hasSignature: true, hasSeal: true, applicableTypes: ["transfer-certificate", "bonafide-certificate", "character-certificate", "study-certificate", "conduct-certificate", "school-leaving-certificate", "achievement-certificate"] },
    { id: "sig-vp", name: "Mr. Rahul Menon", designation: "Vice Principal", hasSignature: true, hasSeal: false, applicableTypes: ["bonafide-certificate", "attendance-certificate", "study-certificate"] },
    { id: "sig-admin", name: "Ms. Kavya Iyer", designation: "Administrator", hasSignature: true, hasSeal: true, applicableTypes: ["student-id", "staff-id", "library-card", "transport-card", "hostel-card"] },
    { id: "sig-hr", name: "Mr. Sanjay Rao", designation: "HR Manager", hasSignature: true, hasSeal: true, applicableTypes: ["offer-letter", "appointment-letter", "experience-letter", "relieving-letter", "salary-certificate", "employment-certificate"] },
    { id: "sig-exam", name: "Mrs. Anjali Desai", designation: "Examination Controller", hasSignature: true, hasSeal: false, applicableTypes: ["admit-card"] },
    { id: "sig-lib", name: "Ms. Priya Nair", designation: "Librarian", hasSignature: true, hasSeal: false, applicableTypes: ["library-card"] },
  ];

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------
  const idStyles: IdCardStyle[] = ["premium-teal", "campus-modern", "classic-school", "minimal-institutional", "junior-friendly"];
  const idBase = (): TemplateSection[] => [section("logo", 0, { align: "center" }), section("photo", 1, { align: "center" }), section("name", 2, { align: "center", fontSize: "base", fontWeight: "bold" }), section("class", 3, { align: "center" }), section("admission-number", 4, { align: "center" }), section("qr", 5, { align: "center" }), section("validity", 6, { align: "center", fontSize: "xs" })];
  const certBase = (): TemplateSection[] => [section("logo", 0, { align: "center" }), section("school-name", 1, { align: "center", fontSize: "lg", fontWeight: "bold" }), section("document-number", 2, { align: "right", fontSize: "xs" }), section("body", 3, { align: "center" }), section("seal", 4, { align: "left" }), section("signature", 5, { align: "right" }), section("footer", 6, { align: "center", fontSize: "xs" })];
  const letterBase = (): TemplateSection[] => [section("logo", 0, { align: "left" }), section("school-name", 1, { align: "left", fontSize: "base", fontWeight: "bold" }), section("document-number", 2, { align: "right", fontSize: "xs" }), section("recipient", 3, { align: "left" }), section("subject", 4, { align: "left", fontWeight: "semibold" }), section("body", 5, { align: "left" }), section("signature", 6, { align: "left" }), section("qr", 7, { align: "right" }), section("footer", 8, { align: "center", fontSize: "xs" })];

  const templates: DocumentTemplate[] = [
    { id: "tpl-stu-id", name: "Student ID — Premium Teal", kind: "id-card", docType: "student-id", paperSize: "cr80", orientation: "portrait", accent: "#18b0c8", style: "premium-teal", sections: idBase(), variables: ["student_name", "admission_number", "class", "section"], signatoryId: "sig-admin", numberingRuleId: "num-idstu", usageCount: 212, updatedAt: daysAgo(6), status: "active", isDefault: true, thumbnailTone: "info" },
    { id: "tpl-stu-id-jr", name: "Student ID — Junior Friendly", kind: "id-card", docType: "student-id", paperSize: "cr80", orientation: "portrait", accent: "#f59e0b", style: "junior-friendly", sections: idBase(), variables: ["student_name", "admission_number", "class"], numberingRuleId: "num-idstu", usageCount: 64, updatedAt: daysAgo(20), status: "active", isDefault: false, thumbnailTone: "warning" },
    { id: "tpl-staff-id", name: "Staff ID — Campus Modern", kind: "id-card", docType: "staff-id", paperSize: "cr80", orientation: "portrait", accent: "#022c43", style: "campus-modern", sections: idBase(), variables: ["employee_name", "employee_id", "designation"], signatoryId: "sig-admin", numberingRuleId: "num-idstaff", usageCount: 58, updatedAt: daysAgo(9), status: "active", isDefault: true, thumbnailTone: "neutral" },
    { id: "tpl-lib-card", name: "Library Card — Minimal", kind: "id-card", docType: "library-card", paperSize: "cr80", orientation: "landscape", accent: "#15803d", style: "minimal-institutional", sections: idBase(), variables: ["student_name", "member_id"], signatoryId: "sig-lib", usageCount: 41, updatedAt: daysAgo(30), status: "active", isDefault: true, thumbnailTone: "success" },
    { id: "tpl-transport-card", name: "Transport Card — Classic", kind: "id-card", docType: "transport-card", paperSize: "cr80", orientation: "landscape", accent: "#7c3aed", style: "classic-school", sections: idBase(), variables: ["student_name", "route", "stop"], usageCount: 33, updatedAt: daysAgo(15), status: "active", isDefault: true, thumbnailTone: "info" },
    { id: "tpl-hostel-card", name: "Hostel Card — Classic", kind: "id-card", docType: "hostel-card", paperSize: "cr80", orientation: "landscape", accent: "#0891b2", style: "classic-school", sections: idBase(), variables: ["student_name", "building", "room"], usageCount: 22, updatedAt: daysAgo(25), status: "active", isDefault: true, thumbnailTone: "info" },
    { id: "tpl-visitor-badge", name: "Visitor Badge", kind: "visitor-badge", docType: "visitor-badge", paperSize: "cr80", orientation: "portrait", accent: "#c2410c", style: "minimal-institutional", sections: idBase(), variables: ["name", "validity"], usageCount: 96, updatedAt: daysAgo(2), status: "active", isDefault: true, thumbnailTone: "warning" },
    { id: "tpl-bonafide", name: "Bonafide Certificate", kind: "student-certificate", docType: "bonafide-certificate", paperSize: "cert-portrait", orientation: "portrait", accent: "#0891b2", sections: certBase(), variables: ["student_name", "class", "academic_session", "certificate_number", "issue_date"], signatoryId: "sig-principal", numberingRuleId: "num-bon", usageCount: 118, updatedAt: daysAgo(4), status: "active", isDefault: true, thumbnailTone: "info" },
    { id: "tpl-transfer", name: "Transfer Certificate", kind: "student-certificate", docType: "transfer-certificate", paperSize: "a4", orientation: "portrait", accent: "#022c43", sections: certBase(), variables: ["student_name", "admission_number", "father_name", "class", "certificate_number", "issue_date"], signatoryId: "sig-principal", numberingRuleId: "num-tc", usageCount: 39, updatedAt: daysAgo(12), status: "active", isDefault: true, thumbnailTone: "neutral" },
    { id: "tpl-character", name: "Character Certificate", kind: "student-certificate", docType: "character-certificate", paperSize: "cert-portrait", orientation: "portrait", accent: "#15803d", sections: certBase(), variables: ["student_name", "class", "academic_session", "certificate_number"], signatoryId: "sig-principal", numberingRuleId: "num-bon", usageCount: 47, updatedAt: daysAgo(18), status: "active", isDefault: true, thumbnailTone: "success" },
    { id: "tpl-study", name: "Study Certificate", kind: "student-certificate", docType: "study-certificate", paperSize: "cert-portrait", orientation: "portrait", accent: "#7c3aed", sections: certBase(), variables: ["student_name", "class", "academic_session"], signatoryId: "sig-vp", numberingRuleId: "num-bon", usageCount: 28, updatedAt: daysAgo(22), status: "active", isDefault: false, thumbnailTone: "info" },
    { id: "tpl-participation", name: "Participation Certificate", kind: "activity-certificate", docType: "participation-certificate", paperSize: "cert-landscape", orientation: "landscape", accent: "#18b0c8", sections: certBase(), variables: ["student_name", "event_name", "issue_date"], signatoryId: "sig-principal", usageCount: 204, updatedAt: daysAgo(3), status: "active", isDefault: true, thumbnailTone: "info" },
    { id: "tpl-sports", name: "Sports Certificate", kind: "activity-certificate", docType: "sports-certificate", paperSize: "cert-landscape", orientation: "landscape", accent: "#c2410c", sections: certBase(), variables: ["student_name", "event_name", "position"], signatoryId: "sig-principal", usageCount: 88, updatedAt: daysAgo(7), status: "active", isDefault: false, thumbnailTone: "warning" },
    { id: "tpl-experience", name: "Experience Letter", kind: "letter", docType: "experience-letter", paperSize: "a4", orientation: "portrait", accent: "#022c43", sections: letterBase(), variables: ["employee_name", "employee_id", "designation", "issue_date"], signatoryId: "sig-hr", numberingRuleId: "num-exp", usageCount: 24, updatedAt: daysAgo(10), status: "active", isDefault: true, thumbnailTone: "neutral" },
    { id: "tpl-appointment", name: "Appointment Letter", kind: "letter", docType: "appointment-letter", paperSize: "a4", orientation: "portrait", accent: "#0891b2", sections: letterBase(), variables: ["employee_name", "designation", "issue_date"], signatoryId: "sig-hr", numberingRuleId: "num-exp", usageCount: 31, updatedAt: daysAgo(14), status: "active", isDefault: true, thumbnailTone: "info" },
    { id: "tpl-salary", name: "Salary Certificate", kind: "staff-certificate", docType: "salary-certificate", paperSize: "a4", orientation: "portrait", accent: "#15803d", sections: letterBase(), variables: ["employee_name", "employee_id", "designation"], signatoryId: "sig-hr", numberingRuleId: "num-exp", usageCount: 17, updatedAt: daysAgo(16), status: "active", isDefault: false, thumbnailTone: "success" },
    { id: "tpl-admit", name: "Exam Admit Card", kind: "admit-card", docType: "admit-card", paperSize: "a5", orientation: "portrait", accent: "#022c43", sections: [section("logo", 0, { align: "center" }), section("school-name", 1, { align: "center", fontWeight: "bold" }), section("photo", 2, { align: "right" }), section("name", 3), section("class", 4), section("document-number", 5), section("qr", 6, { align: "right" }), section("signature", 7, { align: "right" }), section("footer", 8, { align: "center", fontSize: "xs" })], variables: ["student_name", "class", "roll_number", "exam_name"], signatoryId: "sig-exam", numberingRuleId: "num-adm", usageCount: 306, updatedAt: daysAgo(1), status: "active", isDefault: true, thumbnailTone: "neutral" },
    { id: "tpl-fee-receipt", name: "Fee Receipt", kind: "receipt", docType: "fee-receipt", paperSize: "thermal", orientation: "portrait", accent: "#0891b2", sections: [section("school-name", 0, { align: "center", fontWeight: "bold" }), section("document-number", 1, { align: "center" }), section("body", 2), section("footer", 3, { align: "center", fontSize: "xs" })], variables: ["student_name", "certificate_number", "issue_date"], usageCount: 640, updatedAt: daysAgo(1), status: "active", isDefault: true, thumbnailTone: "info" },
    { id: "tpl-attendance-cert", name: "Attendance Certificate", kind: "student-certificate", docType: "attendance-certificate", paperSize: "cert-portrait", orientation: "portrait", accent: "#7c3aed", sections: certBase(), variables: ["student_name", "class", "academic_session"], signatoryId: "sig-vp", numberingRuleId: "num-bon", usageCount: 12, updatedAt: daysAgo(40), status: "draft", isDefault: false, thumbnailTone: "info" },
    { id: "tpl-custom", name: "Custom Document", kind: "custom", docType: "custom-document", paperSize: "a4", orientation: "portrait", accent: "#18b0c8", sections: letterBase(), variables: ["name", "custom_text"], usageCount: 5, updatedAt: daysAgo(50), status: "draft", isDefault: false, thumbnailTone: "neutral" },
  ];

  // -------------------------------------------------------------------------
  // Generated documents (certificates / letters / admit cards / receipts)
  // -------------------------------------------------------------------------
  const documents: GeneratedDocument[] = [];
  const versions: DocumentVersion[] = [];
  const certTypes: { type: DocumentType; tpl: string; kind: GeneratedDocument["kind"]; sig: string }[] = [
    { type: "bonafide-certificate", tpl: "tpl-bonafide", kind: "student-certificate", sig: "Dr. Meera Krishnan" },
    { type: "transfer-certificate", tpl: "tpl-transfer", kind: "student-certificate", sig: "Dr. Meera Krishnan" },
    { type: "character-certificate", tpl: "tpl-character", kind: "student-certificate", sig: "Dr. Meera Krishnan" },
    { type: "study-certificate", tpl: "tpl-study", kind: "student-certificate", sig: "Mr. Rahul Menon" },
    { type: "participation-certificate", tpl: "tpl-participation", kind: "activity-certificate", sig: "Dr. Meera Krishnan" },
  ];
  const statuses: DocumentStatus[] = ["generated", "issued", "issued", "printed", "draft", "revoked", "replaced"];
  let docSeq = 0;
  certTypes.forEach((ct) => {
    const picks = helpers.pickMany(activeStudents, 6);
    picks.forEach((s) => {
      docSeq += 1;
      const status = helpers.pick(statuses);
      const num = `${ct.type === "transfer-certificate" ? "TC" : "BON"}/2026/${String(120 + docSeq).padStart(4, "0")}`;
      const gen = daysAgo(helpers.int(1, 60));
      documents.push({
        id: `doc-${docSeq}`, number: num, type: ct.type, kind: ct.kind, templateId: ct.tpl, templateName: templates.find((t) => t.id === ct.tpl)!.name,
        recipient: { id: `rec-${s.id}`, type: "student", refId: s.id, name: studentName(s), subtitle: classLabel(s) },
        status, paperSize: templates.find((t) => t.id === ct.tpl)!.paperSize, generatedAt: gen, generatedBy: "Ms. Kavya Iyer", issuedDate: status === "issued" ? gen : undefined,
        version: status === "replaced" ? 2 : 1, printCount: status === "printed" || status === "issued" ? helpers.int(1, 3) : 0, verifyCount: helpers.int(0, 5), verificationToken: token(), signatoryName: ct.sig,
        fields: { studentName: studentName(s), class: classLabel(s), session: DOC_BRANDING.session, purpose: helpers.pick(["Bank account opening", "Passport application", "Scholarship application", "Address proof"]), fatherName: `Mr. ${s.profile.lastName}`, reason: "Relocation", conduct: "Good", attendance: `${helpers.int(85, 98)}%` },
      });
      if (status === "replaced") {
        versions.push({ id: `ver-${docSeq}-1`, documentId: `doc-${docSeq}`, version: 1, label: "Generated", at: daysAgo(helpers.int(40, 60)), by: "Ms. Kavya Iyer" });
        versions.push({ id: `ver-${docSeq}-2`, documentId: `doc-${docSeq}`, version: 2, label: "Reissued", at: gen, by: "Ms. Kavya Iyer", note: "Corrected spelling of guardian name" });
      } else {
        versions.push({ id: `ver-${docSeq}-1`, documentId: `doc-${docSeq}`, version: 1, label: "Generated", at: gen, by: "Ms. Kavya Iyer" });
      }
    });
  });
  // A couple of staff letters.
  staff.slice(0, 4).forEach((e, i) => {
    docSeq += 1;
    const gen = daysAgo(helpers.int(2, 30));
    const type: DocumentType = helpers.pick(["experience-letter", "appointment-letter", "salary-certificate", "employment-certificate"]);
    documents.push({
      id: `doc-${docSeq}`, number: `EXP/STAFF/2026/${String(10 + i).padStart(3, "0")}`, type, kind: type === "salary-certificate" || type === "employment-certificate" ? "staff-certificate" : "letter", templateId: "tpl-experience", templateName: "Experience Letter",
      recipient: { id: `rec-${e.id}`, type: "staff", refId: e.id, name: `${e.firstName} ${e.lastName}`, subtitle: e.employeeCode },
      status: helpers.pick(["issued", "generated", "printed"] as DocumentStatus[]), paperSize: "a4", generatedAt: gen, generatedBy: "Mr. Sanjay Rao", issuedDate: gen, version: 1, printCount: helpers.int(0, 2), verifyCount: helpers.int(0, 3), verificationToken: token(), signatoryName: "Mr. Sanjay Rao",
      fields: { employeeName: `${e.firstName} ${e.lastName}`, employeeId: e.employeeCode, designation: e.isTeaching ? "Teacher" : "Staff", joiningDate: e.joiningDate },
    });
    versions.push({ id: `ver-${docSeq}-1`, documentId: `doc-${docSeq}`, version: 1, label: "Generated", at: gen, by: "Mr. Sanjay Rao" });
  });

  // -------------------------------------------------------------------------
  // ID cards
  // -------------------------------------------------------------------------
  const idCards: IdCardRecord[] = [];
  activeStudents.slice(0, 40).forEach((s, i) => {
    const status = i < 3 ? "not-generated" : helpers.pick(["issued", "issued", "issued", "generated", "printed", "expired", "replaced"] as const);
    idCards.push({
      id: `idc-stu-${i}`, cardNumber: `ID/STU/2026/${String(100 + i).padStart(3, "0")}`, kind: "student", holderId: s.id, holderName: studentName(s), subtitle: classLabel(s), photoColor: `hsl(${(i * 47) % 360} 55% 55%)`,
      style: helpers.pick(idStyles), issueDate: status === "not-generated" ? undefined : daysAgo(helpers.int(20, 300)), expiryDate: daysFromNow(helpers.int(30, 400)), status, verificationToken: token(),
      extra: { admissionNumber: s.admissionNumber, guardian: `Mr. ${s.profile.lastName}`, guardianPhone: "+91 •••• ••" + String(helpers.int(1000, 9999)), bloodGroup: s.profile.bloodGroup ?? "" },
    });
  });
  staff.slice(0, 16).forEach((e, i) => {
    const status = helpers.pick(["issued", "issued", "generated", "printed", "expired"] as const);
    idCards.push({
      id: `idc-staff-${i}`, cardNumber: `ID/STF/2026/${String(20 + i).padStart(3, "0")}`, kind: "staff", holderId: e.id, holderName: `${e.firstName} ${e.lastName}`, subtitle: e.isTeaching ? "Teaching Staff" : "Administrative Staff", photoColor: e.photoColor,
      style: "campus-modern", issueDate: daysAgo(helpers.int(30, 400)), expiryDate: daysFromNow(helpers.int(-30, 500)), status, verificationToken: token(),
      extra: { employeeId: e.employeeCode, department: e.branch, emergencyContact: "+91 •••• ••" + String(helpers.int(1000, 9999)) },
    });
  });
  // A few library/transport/hostel cards.
  activeStudents.slice(40, 46).forEach((s, i) => {
    idCards.push({ id: `idc-lib-${i}`, cardNumber: `LIB/2026/${String(50 + i).padStart(3, "0")}`, kind: "library", holderId: s.id, holderName: studentName(s), subtitle: classLabel(s), photoColor: `hsl(${(i * 61) % 360} 50% 50%)`, style: "minimal-institutional", issueDate: daysAgo(60), expiryDate: daysFromNow(300), status: "issued", verificationToken: token(), extra: { memberId: `LM-${1000 + i}` } });
  });
  activeStudents.slice(46, 50).forEach((s, i) => {
    idCards.push({ id: `idc-trn-${i}`, cardNumber: `TRN/2026/${String(30 + i).padStart(3, "0")}`, kind: "transport", holderId: s.id, holderName: studentName(s), subtitle: classLabel(s), photoColor: `hsl(${(i * 71) % 360} 50% 50%)`, style: "classic-school", issueDate: daysAgo(45), expiryDate: daysFromNow(200), status: "issued", verificationToken: token(), extra: { route: `Route ${helpers.int(1, 8)}`, stop: helpers.pick(["Sector 21", "Civil Lines", "Market Rd", "Green Park"]), emergencyContact: "+91 •••• ••" + String(helpers.int(1000, 9999)) } });
  });
  activeStudents.slice(50, 53).forEach((s, i) => {
    idCards.push({ id: `idc-hst-${i}`, cardNumber: `HST/2026/${String(10 + i).padStart(3, "0")}`, kind: "hostel", holderId: s.id, holderName: studentName(s), subtitle: classLabel(s), photoColor: `hsl(${(i * 83) % 360} 50% 50%)`, style: "classic-school", issueDate: daysAgo(70), expiryDate: daysFromNow(250), status: "issued", verificationToken: token(), extra: { building: helpers.pick(["Tagore", "Kalpana"]), room: String(helpers.int(101, 320)), warden: "Suresh Pillai" } });
  });

  // -------------------------------------------------------------------------
  // Batches + items
  // -------------------------------------------------------------------------
  const batches: DocumentBatch[] = [];
  const batchItems: DocumentBatchItem[] = [];
  const batchDefs: { name: string; type: DocumentType; tpl: string; group: string; status: DocumentBatch["status"] }[] = [
    { name: "Class 5-A Student IDs", type: "student-id", tpl: "tpl-stu-id", group: "Class 5 · A", status: "ready" },
    { name: "Term 1 Admit Cards — Class 10", type: "admit-card", tpl: "tpl-admit", group: "Class 10 (all sections)", status: "running" },
    { name: "Sports Day Participation", type: "participation-certificate", tpl: "tpl-participation", group: "Athletics participants", status: "completed" },
    { name: "New Staff IDs", type: "staff-id", tpl: "tpl-staff-id", group: "All teaching staff", status: "failed" },
    { name: "Fee Statements — August", type: "fee-statement", tpl: "tpl-fee-receipt", group: "Class 6 · A", status: "draft" },
  ];
  batchDefs.forEach((b, bi) => {
    const pool = b.type === "staff-id" ? staff.map((e) => ({ name: `${e.firstName} ${e.lastName}`, sub: e.employeeCode })) : activeStudents.slice(bi * 8, bi * 8 + helpers.int(30, 44)).map((s) => ({ name: studentName(s), sub: classLabel(s) }));
    const total = pool.length;
    let ready = 0, missing = 0, failed = 0;
    pool.forEach((p, i) => {
      const roll = helpers.rand();
      let st: DocumentBatchItem["status"];
      let issue: string | undefined;
      if (b.status === "completed") { st = "generated"; ready++; }
      else if (roll < 0.86) { st = "ready"; ready++; }
      else if (roll < 0.95) { st = "missing-info"; missing++; issue = helpers.pick(["Missing photo", "Missing admission number", "Missing guardian details"]); }
      else { st = b.status === "failed" ? "failed" : "missing-info"; if (st === "failed") failed++; else { missing++; issue = "Missing photo"; } }
      batchItems.push({ id: `bi-${bi}-${i}`, batchId: `batch-${bi}`, recipientName: p.name, recipientSubtitle: p.sub, status: st, issue });
    });
    batches.push({ id: `batch-${bi}`, name: b.name, docType: b.type, templateId: b.tpl, groupLabel: b.group, total, ready, missing, failed, estimatedPages: b.type === "student-id" || b.type === "staff-id" ? Math.ceil(total / 10) : total, status: b.status, createdAt: isoTime(helpers.int(1, 120)), createdBy: "Ms. Kavya Iyer" });
  });

  // -------------------------------------------------------------------------
  // Print queue
  // -------------------------------------------------------------------------
  const printQueue: PrintQueueItem[] = documents.slice(0, 8).map((d, i) => ({
    id: `pq-${i}`, documentNumber: d.number, documentType: d.type, owner: d.recipient.name, pages: d.paperSize === "cr80" ? 1 : helpers.int(1, 2), copies: helpers.int(1, 3), paperSize: d.paperSize,
    printer: helpers.pick(["Front Office HP", "Admin Ricoh", "Exam Cell Canon"]), layout: d.paperSize === "cr80" ? "id-sheet" : d.kind === "receipt" ? "thermal" : "one-per-page",
    addedBy: "Ms. Kavya Iyer", addedAt: isoTime(helpers.int(0, 12)), status: helpers.pick(["queued", "preparing", "ready", "printing", "printed", "failed"] as const),
  }));
  // Add a couple of ID-card print jobs.
  idCards.filter((c) => c.status === "generated").slice(0, 3).forEach((c, i) => {
    printQueue.push({ id: `pq-id-${i}`, documentNumber: c.cardNumber, documentType: c.kind === "staff" ? "staff-id" : "student-id", owner: c.holderName, pages: 1, copies: 1, paperSize: "cr80", printer: "Card Printer (Evolis)", layout: "duplex-id", addedBy: "Ms. Kavya Iyer", addedAt: isoTime(helpers.int(0, 6)), status: "queued" });
  });

  // -------------------------------------------------------------------------
  // Verification records
  // -------------------------------------------------------------------------
  const verifications: VerificationRecord[] = documents.slice(0, 10).map((d, i) => ({
    id: `vr-${i}`, token: d.verificationToken, documentNumber: d.number, documentType: d.type, recipientName: d.recipient.name, issuedDate: d.issuedDate ?? d.generatedAt,
    state: d.status === "revoked" ? "revoked" : d.status === "replaced" ? "replaced" : d.status === "expired" ? "expired" : "valid", checkedAt: isoTime(helpers.int(0, 200)),
  }));

  return { numberingRules, signatories, templates, documents, versions, idCards, batches, batchItems, printQueue, verifications };
}
