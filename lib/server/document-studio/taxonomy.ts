// The fixed, narrow set of document types this phase actually supports —
// each backed by real data end to end. See the schema doc-comment on
// DocumentTemplate for what was deliberately excluded (transfer/character/
// conduct/salary certificates, most HR letters, admit cards, receipts) and
// why. Adding a new docType here always means adding real merge fields for
// it first — never the other way round.
export type DocTypeKey = "STUDENT_ID" | "STAFF_ID" | "BONAFIDE_CERTIFICATE" | "STUDY_CERTIFICATE" | "ACHIEVEMENT_CERTIFICATE" | "EMPLOYMENT_CERTIFICATE";

export const DOC_TYPE_TAXONOMY: Record<DocTypeKey, { kind: "ID_CARD" | "STUDENT_CERTIFICATE" | "STAFF_CERTIFICATE"; subjectType: "STUDENT" | "STAFF" }> = {
  STUDENT_ID: { kind: "ID_CARD", subjectType: "STUDENT" },
  STAFF_ID: { kind: "ID_CARD", subjectType: "STAFF" },
  BONAFIDE_CERTIFICATE: { kind: "STUDENT_CERTIFICATE", subjectType: "STUDENT" },
  STUDY_CERTIFICATE: { kind: "STUDENT_CERTIFICATE", subjectType: "STUDENT" },
  ACHIEVEMENT_CERTIFICATE: { kind: "STUDENT_CERTIFICATE", subjectType: "STUDENT" },
  EMPLOYMENT_CERTIFICATE: { kind: "STAFF_CERTIFICATE", subjectType: "STAFF" },
};

export const DOC_TYPE_KEYS = Object.keys(DOC_TYPE_TAXONOMY) as DocTypeKey[];
