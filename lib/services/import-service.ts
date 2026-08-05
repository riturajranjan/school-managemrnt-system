import Papa from "papaparse";
import { getSnapshot, setState } from "@/lib/data/store";
import { schoolClasses } from "@/lib/data/seed/reference";
import type { Guardian, Student, StudentGuardianLink } from "@/lib/types/students";
import type { ImportJob, ImportRowError, StudentImportField } from "@/lib/types/import";
import { studentImportOptionalFields, studentImportRequiredFields } from "@/lib/types/import";
import { generateId } from "@/lib/utils";

const allFields: readonly string[] = [...studentImportRequiredFields, ...studentImportOptionalFields];

export function generateTemplateCsv(): string {
  const example: Record<string, string> = {
    firstName: "Aarav",
    lastName: "Sharma",
    dob: "2016-04-12",
    gender: "male",
    className: "Class 5",
    sectionName: "A",
    guardianFirstName: "Rohit",
    guardianPhone: "+91 98765 43210",
    middleName: "",
    admissionNumber: "",
    rollNumber: "",
    bloodGroup: "O+",
    nationality: "Indian",
    religion: "",
    category: "",
    guardianEmail: "rohit.sharma@example.com",
    guardianRelationship: "father",
  };
  return Papa.unparse({ fields: [...allFields], data: [allFields.map((f) => example[f] ?? "")] });
}

export type ParsedCsv = { headers: string[]; rows: Record<string, string>[] };

export function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return { headers: result.meta.fields ?? [], rows: result.data };
}

export type MappedRow = Record<StudentImportField, string> & { __row: number };

export function applyColumnMapping(rows: Record<string, string>[], mapping: Record<string, string>): MappedRow[] {
  return rows.map((row, index) => {
    const mapped = {} as MappedRow;
    for (const field of allFields) {
      const sourceColumn = mapping[field];
      mapped[field as StudentImportField] = sourceColumn ? (row[sourceColumn] ?? "").trim() : "";
    }
    mapped.__row = index + 2; // +1 header row, +1 to be 1-indexed for humans
    return mapped;
  });
}

const genderValues = new Set(["male", "female", "other", "prefer-not-to-say"]);

export function validateMappedRows(rows: MappedRow[]): { valid: MappedRow[]; errors: ImportRowError[] } {
  const db = getSnapshot();
  const errors: ImportRowError[] = [];
  const valid: MappedRow[] = [];
  const seenAdmissionNumbers = new Set<string>();

  for (const row of rows) {
    const rowErrors: ImportRowError[] = [];

    for (const field of studentImportRequiredFields) {
      if (!row[field]) rowErrors.push({ row: row.__row, field, message: `${field} is required` });
    }

    if (row.dob && Number.isNaN(new Date(row.dob).getTime())) {
      rowErrors.push({ row: row.__row, field: "dob", message: "Invalid date format — use YYYY-MM-DD" });
    }

    if (row.gender && !genderValues.has(row.gender.toLowerCase())) {
      rowErrors.push({ row: row.__row, field: "gender", message: `Invalid gender "${row.gender}"` });
    }

    if (row.className && !schoolClasses.some((c) => c.name.toLowerCase() === row.className.toLowerCase())) {
      rowErrors.push({ row: row.__row, field: "className", message: `Unknown class "${row.className}"` });
    } else if (row.className && row.sectionName) {
      const schoolClass = schoolClasses.find((c) => c.name.toLowerCase() === row.className.toLowerCase());
      if (schoolClass && !schoolClass.sections.some((s) => s.name.toLowerCase() === row.sectionName.toLowerCase())) {
        rowErrors.push({ row: row.__row, field: "sectionName", message: `Unknown section "${row.sectionName}" for ${row.className}` });
      }
    }

    if (row.admissionNumber) {
      const key = row.admissionNumber.toLowerCase();
      if (db.students.some((s) => s.admissionNumber.toLowerCase() === key)) {
        rowErrors.push({ row: row.__row, field: "admissionNumber", message: `Admission number "${row.admissionNumber}" already exists` });
      } else if (seenAdmissionNumbers.has(key)) {
        rowErrors.push({ row: row.__row, field: "admissionNumber", message: `Duplicate admission number "${row.admissionNumber}" within file` });
      }
      seenAdmissionNumbers.add(key);
    }

    if (row.guardianPhone && !/^[+()\s\d-]{8,}$/.test(row.guardianPhone)) {
      rowErrors.push({ row: row.__row, field: "guardianPhone", message: "Invalid guardian phone number" });
    }

    if (row.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.guardianEmail)) {
      rowErrors.push({ row: row.__row, field: "guardianEmail", message: "Invalid guardian email" });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      valid.push(row);
    }
  }

  return { valid, errors };
}

export function commitImport(job: ImportJob, validRows: MappedRow[]): void {
  const now = new Date().toISOString();
  const newStudents: Student[] = [];
  const newGuardians: Guardian[] = [];
  const newLinks: StudentGuardianLink[] = [];

  for (const row of validRows) {
    const schoolClass = schoolClasses.find((c) => c.name.toLowerCase() === row.className.toLowerCase())!;
    const section = schoolClass.sections.find((s) => s.name.toLowerCase() === row.sectionName.toLowerCase())!;
    const studentId = generateId("student");
    const guardianId = generateId("guardian");

    newGuardians.push({
      id: guardianId,
      firstName: row.guardianFirstName,
      lastName: row.lastName,
      contact: { phone: row.guardianPhone, email: row.guardianEmail || undefined },
      communicationPreference: "sms",
    });

    newLinks.push({
      studentId,
      guardianId,
      relationship: (row.guardianRelationship as StudentGuardianLink["relationship"]) || "guardian",
      isPrimary: true,
      isEmergencyContact: true,
      isAuthorizedPickup: true,
      isFeeResponsible: true,
    });

    newStudents.push({
      id: studentId,
      admissionNumber: row.admissionNumber || `IMP-${studentId.slice(-6).toUpperCase()}`,
      rollNumber: row.rollNumber || undefined,
      profile: {
        firstName: row.firstName,
        middleName: row.middleName || undefined,
        lastName: row.lastName,
        dob: row.dob,
        gender: (row.gender.toLowerCase() as Student["profile"]["gender"]) || "prefer-not-to-say",
        bloodGroup: row.bloodGroup || undefined,
        nationality: row.nationality || "Indian",
        religion: row.religion || undefined,
        category: row.category || undefined,
      },
      classId: schoolClass.id,
      sectionId: section.id,
      session: "2026-2027",
      branchId: "main",
      status: "active",
      admissionDate: now,
      admissionType: "new",
      address: { line1: "", city: "", state: "", postalCode: "", country: "India" },
      guardianIds: [guardianId],
      primaryGuardianId: guardianId,
      academics: { overallPercent: 0, trend: "flat", upcomingExams: [], recentHomework: [], subjectsAtRisk: [] },
      attendance: { presentPercent: 100, presentDays: 0, absentDays: 0, lateDays: 0, totalDays: 0, todayStatus: "not-marked", trend7Day: [100, 100, 100, 100, 100, 100, 100] },
      fees: { status: "pending", totalDue: 0, totalPaid: 0, overdueAmount: 0 },
      health: { emergencyContactName: row.guardianFirstName, emergencyContactPhone: row.guardianPhone, allergies: [], conditions: [], medications: [] },
      behaviourNotes: [],
      pulse: {
        overallScore: 75,
        status: "good",
        positiveTrend: "New enrollment — baseline pulse not yet established",
        mainRisk: "Insufficient data",
        suggestedAction: "Pulse will populate as attendance and academic data accrues.",
        explanation: "Pulse blends attendance, gradebook, homework, and behaviour records into six weighted dimensions.",
        dimensions: (["academics", "attendance", "engagement", "behaviour", "homework", "wellbeing"] as const).map((key) => ({
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
          score: 75,
          tone: "info" as const,
          trend: "flat" as const,
          summary: "New enrollment — establishing baseline",
        })),
      },
      documents: [],
      timeline: [{ id: generateId("evt"), subjectId: studentId, category: "admission", title: "Imported via CSV import", actorName: job.performedBy, createdAt: now }],
      createdAt: now,
      updatedAt: now,
    });
  }

  setState((db) => ({
    ...db,
    students: [...newStudents, ...db.students],
    guardians: [...db.guardians, ...newGuardians],
    studentGuardianLinks: [...db.studentGuardianLinks, ...newLinks],
    importJobs: [{ ...job, importedRows: newStudents.length, status: "completed", completedAt: now }, ...db.importJobs.filter((j) => j.id !== job.id)],
  }));
}

export function rejectedRowsToCsv(rows: MappedRow[], errors: ImportRowError[]): string {
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
