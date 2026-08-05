import type { ID } from "./common";

export type ImportRowError = {
  row: number;
  field?: string;
  message: string;
};

export type ImportStatus = "mapping" | "validating" | "reviewing" | "importing" | "completed" | "failed";

export type ImportJob = {
  id: ID;
  fileName: string;
  uploadedAt: string;
  status: ImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  columnMapping: Record<string, string>;
  errors: ImportRowError[];
  completedAt?: string;
  performedBy: string;
};

// Required target fields the CSV/spreadsheet must map onto before validation.
export const studentImportRequiredFields = [
  "firstName",
  "lastName",
  "dob",
  "gender",
  "className",
  "sectionName",
  "guardianFirstName",
  "guardianPhone",
] as const;

export const studentImportOptionalFields = [
  "middleName",
  "admissionNumber",
  "rollNumber",
  "bloodGroup",
  "nationality",
  "religion",
  "category",
  "guardianEmail",
  "guardianRelationship",
] as const;

export type StudentImportField =
  | (typeof studentImportRequiredFields)[number]
  | (typeof studentImportOptionalFields)[number];
