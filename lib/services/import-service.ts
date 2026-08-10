import Papa from "papaparse";
import { schoolClasses } from "@/lib/data/seed/reference";
import type { ImportRowError, StudentImportField } from "@/lib/types/import";
import { studentImportOptionalFields, studentImportRequiredFields } from "@/lib/types/import";

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

// Client-side preliminary validation (UX only — the server re-validates and is
// authoritative, including duplicate-against-database checks). Pure: reads no
// store state.
export function validateMappedRows(rows: MappedRow[]): { valid: MappedRow[]; errors: ImportRowError[] } {
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
      if (seenAdmissionNumbers.has(key)) {
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
