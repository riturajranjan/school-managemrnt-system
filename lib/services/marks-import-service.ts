import Papa from "papaparse";
import { getSnapshot } from "@/lib/data/store";
import type { ExamSubject } from "@/lib/types/exams";
import type { ImportRowError, MarksImportField } from "@/lib/types/import";
import { marksImportOptionalFields, marksImportRequiredFields } from "@/lib/types/import";
import { saveMark } from "./marks-service";

const allFields: readonly string[] = [...marksImportRequiredFields, ...marksImportOptionalFields];

export function generateMarksTemplateCsv(examSubject: ExamSubject): string {
  const fields = allFields.filter((f) => {
    if (f === "theory") return examSubject.theoryMarks > 0;
    if (f === "practical") return examSubject.practicalMarks > 0;
    if (f === "internal") return examSubject.internalMarks > 0;
    if (f === "project") return examSubject.projectMarks > 0;
    return true;
  });
  const example: Record<string, string> = { admissionNumber: "ADM-2026-0001", theory: "78", practical: "24", internal: "8", project: "9", remark: "" };
  return Papa.unparse({ fields, data: [fields.map((f) => example[f] ?? "")] });
}

export type MappedMarksRow = Record<MarksImportField, string> & { __row: number };

export function applyMarksColumnMapping(rows: Record<string, string>[], mapping: Record<string, string>): MappedMarksRow[] {
  return rows.map((row, index) => {
    const mapped = {} as MappedMarksRow;
    for (const field of allFields) {
      const sourceColumn = mapping[field];
      mapped[field as MarksImportField] = sourceColumn ? (row[sourceColumn] ?? "").trim() : "";
    }
    mapped.__row = index + 2;
    return mapped;
  });
}

const componentMax = (examSubject: ExamSubject): Record<string, number> => ({
  theory: examSubject.theoryMarks,
  practical: examSubject.practicalMarks,
  internal: examSubject.internalMarks,
  project: examSubject.projectMarks,
});

export function validateMarksRows(rows: MappedMarksRow[], examSubject: ExamSubject): { valid: MappedMarksRow[]; errors: ImportRowError[] } {
  const db = getSnapshot();
  const errors: ImportRowError[] = [];
  const valid: MappedMarksRow[] = [];
  const seenAdmissionNumbers = new Set<string>();
  const max = componentMax(examSubject);
  const session = db.marksEntrySessions.find((s) => s.examSubjectId === examSubject.id);
  const sectionStudents = db.students.filter((s) => s.sectionId === examSubject.sectionId);

  for (const row of rows) {
    const rowErrors: ImportRowError[] = [];

    for (const field of marksImportRequiredFields) {
      if (!row[field]) rowErrors.push({ row: row.__row, field, message: `${field} is required` });
    }

    const student = row.admissionNumber ? sectionStudents.find((s) => s.admissionNumber.toLowerCase() === row.admissionNumber.toLowerCase()) : undefined;
    if (row.admissionNumber && !student) {
      const existsElsewhere = db.students.some((s) => s.admissionNumber.toLowerCase() === row.admissionNumber.toLowerCase());
      rowErrors.push({ row: row.__row, field: "admissionNumber", message: existsElsewhere ? "Student is not enrolled in this section" : `Unknown admission number "${row.admissionNumber}"` });
    }

    if (row.admissionNumber) {
      const key = row.admissionNumber.toLowerCase();
      if (seenAdmissionNumbers.has(key)) rowErrors.push({ row: row.__row, field: "admissionNumber", message: "Duplicate row for this student within the file" });
      seenAdmissionNumbers.add(key);
    }

    const attendance = student ? db.examAttendance.find((a) => a.examSubjectId === examSubject.id && a.studentId === student.id) : undefined;
    const isAbsent = attendance?.status === "absent" || attendance?.status === "malpractice" || attendance?.status === "withheld";

    for (const component of ["theory", "practical", "internal", "project"] as const) {
      const raw = row[component];
      if (!raw) continue;
      if (max[component] === 0) {
        rowErrors.push({ row: row.__row, field: component, message: `This subject has no ${component} component configured` });
        continue;
      }
      const value = Number(raw);
      if (Number.isNaN(value)) {
        rowErrors.push({ row: row.__row, field: component, message: `"${raw}" is not a valid number` });
        continue;
      }
      if (value < 0) rowErrors.push({ row: row.__row, field: component, message: "Marks can't be negative" });
      if (value > max[component]) rowErrors.push({ row: row.__row, field: component, message: `Exceeds the maximum of ${max[component]}` });
      if (isAbsent) rowErrors.push({ row: row.__row, field: component, message: "Student was marked absent — marks can't be entered" });
    }

    if (session?.status === "locked") rowErrors.push({ row: row.__row, message: "Marks entry is locked for this subject" });

    if (rowErrors.length > 0) errors.push(...rowErrors);
    else valid.push(row);
  }

  return { valid, errors };
}

export function commitMarksImport(examId: string, examSubject: ExamSubject, validRows: MappedMarksRow[], actor: { name: string; role: string }): number {
  const db = getSnapshot();
  let imported = 0;
  for (const row of validRows) {
    const student = db.students.find((s) => s.sectionId === examSubject.sectionId && s.admissionNumber.toLowerCase() === row.admissionNumber.toLowerCase());
    if (!student) continue;
    const patch: Record<string, number> = {};
    for (const component of ["theory", "practical", "internal", "project"] as const) {
      if (row[component]) patch[component] = Number(row[component]);
    }
    const result = saveMark(examId, examSubject, student.id, patch, actor);
    if (result.ok) imported += 1;
  }
  return imported;
}

export function rejectedMarksRowsToCsv(rows: MappedMarksRow[], errors: ImportRowError[]): string {
  const errorsByRow = new Map<number, string[]>();
  for (const error of errors) {
    const list = errorsByRow.get(error.row) ?? [];
    list.push(error.message);
    errorsByRow.set(error.row, list);
  }
  const rejectedRowNumbers = new Set(errorsByRow.keys());
  const rejected = rows.filter((r) => rejectedRowNumbers.has(r.__row));
  const data = rejected.map((row) => ({ ...row, __row: undefined, errors: (errorsByRow.get(row.__row) ?? []).join("; ") }));
  return Papa.unparse(data);
}
