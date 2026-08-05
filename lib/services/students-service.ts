import { setState, type Db } from "@/lib/data/store";
import type { BehaviourNote, Student, StudentFeeStatus, StudentStatus } from "@/lib/types/students";
import type { DocumentStatus, TimelineEvent } from "@/lib/types/common";
import { generateId } from "@/lib/utils";

function nowIso() {
  return new Date().toISOString();
}

function pushTimeline(student: Student, event: Omit<TimelineEvent, "id" | "subjectId" | "createdAt"> & { createdAt?: string }): Student {
  const entry: TimelineEvent = { id: generateId("evt"), subjectId: student.id, createdAt: event.createdAt ?? nowIso(), ...event };
  return { ...student, timeline: [entry, ...student.timeline] };
}

function mapStudent(db: Db, id: string, fn: (student: Student) => Student): Db {
  return { ...db, students: db.students.map((s) => (s.id === id ? { ...fn(s), updatedAt: nowIso() } : s)) };
}

export function updateStudent(studentId: string, patch: Partial<Student>, actorName = "Administrator") {
  setState((db) =>
    mapStudent(db, studentId, (student) => pushTimeline({ ...student, ...patch }, { category: "system", title: "Profile updated", actorName })),
  );
}

export function addStudentNote(studentId: string, body: string, actorName: string) {
  setState((db) => mapStudent(db, studentId, (student) => pushTimeline(student, { category: "system", title: "Note added", detail: body, actorName, manual: true })));
}

export function archiveStudent(studentId: string, actorName: string) {
  setState((db) => mapStudent(db, studentId, (student) => pushTimeline({ ...student, status: "archived" }, { category: "system", title: "Student archived", actorName })));
}

export function restoreStudent(studentId: string, actorName: string) {
  setState((db) => mapStudent(db, studentId, (student) => pushTimeline({ ...student, status: "active" }, { category: "system", title: "Student restored", actorName })));
}

export function markAttendance(studentId: string, status: "present" | "absent" | "late", actorName: string) {
  setState((db) =>
    mapStudent(db, studentId, (student) => {
      const updated: Student = {
        ...student,
        attendance: {
          ...student.attendance,
          todayStatus: status,
          presentDays: status === "present" ? student.attendance.presentDays + 1 : student.attendance.presentDays,
          absentDays: status === "absent" ? student.attendance.absentDays + 1 : student.attendance.absentDays,
          lateDays: status === "late" ? student.attendance.lateDays + 1 : student.attendance.lateDays,
          totalDays: student.attendance.totalDays + 1,
        },
      };
      return pushTimeline(updated, { category: "attendance", title: `Marked ${status} for today`, actorName });
    }),
  );
}

export function recordFeePayment(studentId: string, amount: number, method: string, actorName: string) {
  setState((db) =>
    mapStudent(db, studentId, (student) => {
      const totalPaid = student.fees.totalPaid + amount;
      const status: StudentFeeStatus = totalPaid >= student.fees.totalDue ? "paid" : totalPaid > 0 ? "partial" : student.fees.status;
      const updated: Student = { ...student, fees: { ...student.fees, totalPaid, status, overdueAmount: Math.max(0, student.fees.totalDue - totalPaid) } };
      return pushTimeline(updated, { category: "fees", title: `Payment of ₹${amount.toLocaleString("en-IN")} recorded via ${method}`, actorName });
    }),
  );
}

export function addBehaviourNote(studentId: string, note: Omit<BehaviourNote, "id" | "createdAt">) {
  setState((db) =>
    mapStudent(db, studentId, (student) => {
      const entry: BehaviourNote = { id: generateId("beh"), createdAt: nowIso(), ...note };
      return pushTimeline({ ...student, behaviourNotes: [entry, ...student.behaviourNotes] }, { category: "behaviour", title: note.title, actorName: note.recordedBy });
    }),
  );
}

export function updateStudentDocumentStatus(studentId: string, documentId: string, status: DocumentStatus, verifiedBy?: string, rejectionReason?: string) {
  setState((db) =>
    mapStudent(db, studentId, (student) => {
      const updated: Student = {
        ...student,
        documents: student.documents.map((doc) =>
          doc.id === documentId
            ? { ...doc, status, verifiedAt: status === "approved" ? nowIso() : doc.verifiedAt, verifiedBy: status === "approved" ? verifiedBy : doc.verifiedBy, rejectionReason }
            : doc,
        ),
      };
      return pushTimeline(updated, { category: "documents", title: `Document ${status.replace("-", " ")}`, actorName: verifiedBy ?? "Staff" });
    }),
  );
}

export function uploadStudentDocument(studentId: string, documentId: string, fileName: string, sizeKb: number, uploadedBy: string) {
  setState((db) =>
    mapStudent(db, studentId, (student) => {
      const updated: Student = {
        ...student,
        documents: student.documents.map((doc) =>
          doc.id === documentId
            ? {
                ...doc,
                status: "uploaded" as DocumentStatus,
                fileName,
                sizeKb,
                uploadedAt: nowIso(),
                uploadedBy,
                rejectionReason: undefined,
                versions: [{ id: generateId("ver"), fileName, uploadedAt: nowIso(), uploadedBy, sizeKb }, ...doc.versions],
              }
            : doc,
        ),
      };
      return pushTimeline(updated, { category: "documents", title: "Document uploaded", actorName: uploadedBy });
    }),
  );
}

// --- Bulk actions ---

export function bulkUpdateSection(studentIds: string[], sectionId: string, classId: string, actorName: string) {
  setState((db) => ({
    ...db,
    students: db.students.map((s) =>
      studentIds.includes(s.id) ? pushTimeline({ ...s, sectionId, classId, updatedAt: nowIso() }, { category: "academic", title: "Section changed", actorName }) : s,
    ),
  }));
}

export function bulkAssignTransport(studentIds: string[], routeId: string, routeName: string, actorName: string) {
  setState((db) => ({
    ...db,
    students: db.students.map((s) =>
      studentIds.includes(s.id)
        ? pushTimeline(
            { ...s, transport: { routeId, routeName, stopName: "TBD", pickupTime: "07:15 AM", dropTime: "03:45 PM" }, updatedAt: nowIso() },
            { category: "transport", title: `Assigned to ${routeName}`, actorName },
          )
        : s,
    ),
  }));
}

export function bulkUpdateStatus(studentIds: string[], status: StudentStatus, actorName: string) {
  setState((db) => ({
    ...db,
    students: db.students.map((s) =>
      studentIds.includes(s.id) ? pushTimeline({ ...s, status, updatedAt: nowIso() }, { category: "system", title: `Status changed to ${status}`, actorName }) : s,
    ),
  }));
}

export function bulkAssignFeeStructure(studentIds: string[], feeStructureId: string, actorName: string) {
  setState((db) => ({
    ...db,
    students: db.students.map((s) =>
      studentIds.includes(s.id)
        ? pushTimeline({ ...s, fees: { ...s.fees, feeStructureId }, updatedAt: nowIso() }, { category: "fees", title: "Fee structure assigned", actorName })
        : s,
    ),
  }));
}

export function sendStudentCommunication(studentId: string, channel: "email" | "sms" | "whatsapp", body: string, actorName: string) {
  setState((db) => mapStudent(db, studentId, (student) => pushTimeline(student, { category: "communication", title: `Message sent via ${channel}`, detail: body, actorName })));
}

export function generateCertificate(studentId: string, certificateType: string, actorName: string) {
  setState((db) =>
    mapStudent(db, studentId, (student) => pushTimeline(student, { category: "certificate", title: `${certificateType} generated`, actorName })),
  );
}

export function isDuplicateAdmissionNumber(db: Db, admissionNumber: string, excludeStudentId?: string): boolean {
  return db.students.some((s) => s.id !== excludeStudentId && s.admissionNumber.toLowerCase() === admissionNumber.trim().toLowerCase());
}
