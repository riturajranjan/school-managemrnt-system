"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import {
  applyColumnMapping,
  generateTemplateCsv,
  parseCsvText,
  rejectedRowsToCsv,
  validateMappedRows,
  type MappedRow,
  type ParsedCsv,
} from "@/lib/services/import-service";
import { importStudentsRequest, type ImportDetail } from "@/lib/hooks/api/use-students";
import type { ImportRowError } from "@/lib/types/import";
import { studentImportOptionalFields, studentImportRequiredFields } from "@/lib/types/import";
import { downloadTextFile } from "@/lib/utils";

type Step = "upload" | "mapping" | "review" | "complete";

const allFields = [...studentImportRequiredFields, ...studentImportOptionalFields];
const relationValues = new Set(["father", "mother", "guardian"]);

// Build the canonical, server-validated DTO from a client-validated mapped row.
// The server assigns tenant/school/branch/session — none of that comes from CSV.
function toDto(r: MappedRow) {
  const rel = relationValues.has((r.guardianRelationship || "").toLowerCase()) ? r.guardianRelationship.toLowerCase() : "guardian";
  return {
    admissionNumber: r.admissionNumber || undefined,
    firstName: r.firstName,
    middleName: r.middleName || undefined,
    lastName: r.lastName,
    dateOfBirth: r.dob,
    gender: (r.gender || "prefer-not-to-say").toLowerCase(),
    classLabel: r.className || undefined,
    sectionLabel: r.sectionName || undefined,
    rollNumber: r.rollNumber || undefined,
    bloodGroup: r.bloodGroup || undefined,
    nationality: r.nationality || undefined,
    religion: r.religion || undefined,
    category: r.category || undefined,
    admissionType: "new",
    guardian: r.guardianFirstName
      ? { firstName: r.guardianFirstName, lastName: r.lastName, phone: r.guardianPhone || undefined, email: r.guardianEmail || undefined, relation: rel }
      : undefined,
  };
}

export function ImportWizard() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<{ valid: MappedRow[]; errors: ImportRowError[] } | null>(null);
  const [serverErrors, setServerErrors] = useState<ImportRowError[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  function handleFile(file: File) {
    setImportError(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setImportError("Unsupported file type — upload a .csv file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImportError("File is too large (max 5 MB).");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const result = parseCsvText(text);
      setParsed(result);
      const autoMapping: Record<string, string> = {};
      for (const field of allFields) {
        const match = result.headers.find((h) => h.toLowerCase().replace(/[\s_]/g, "") === field.toLowerCase());
        if (match) autoMapping[field] = match;
      }
      setMapping(autoMapping);
      setStep("mapping");
    };
    reader.readAsText(file);
  }

  function runValidation() {
    if (!parsed) return;
    const mapped = applyColumnMapping(parsed.rows, mapping);
    setValidation(validateMappedRows(mapped));
    setServerErrors([]);
    setImportError(null);
    setStep("review");
  }

  // Real import: POST the canonical DTO. All-or-nothing — enabled only when the
  // client preview has zero errors; the server re-validates authoritatively.
  async function runImport() {
    if (!validation) return;
    setImporting(true);
    setImportError(null);
    setServerErrors([]);
    const students = validation.valid.map(toDto);
    const res = await importStudentsRequest(students);
    setImporting(false);

    if (res.success) {
      setImportedCount(res.data.imported);
      setStep("complete");
      return;
    }
    if (res.error.code === "IMPORT_VALIDATION_ERROR" && res.error.details) {
      // Map server row numbers (position in submitted list) back to CSV lines.
      const mapped: ImportRowError[] = res.error.details.map((d: ImportDetail) => ({
        row: validation.valid[d.row - 1]?.__row ?? d.row,
        field: d.field,
        message: d.message,
      }));
      setServerErrors(mapped);
      setImportError("The server rejected some rows. Nothing was imported — fix the rows below and try again.");
      return;
    }
    setImportError(res.error.message);
  }

  function reset() {
    setStep("upload");
    setFileName("");
    setParsed(null);
    setMapping({});
    setValidation(null);
    setServerErrors([]);
    setImportError(null);
    setImportedCount(0);
  }

  const combinedErrors = validation ? [...validation.errors, ...serverErrors] : [];

  if (!capabilitiesLoading && !hasServerPermission("students.view")) {
    return <PermissionDenied action="import students" role={roleLabels[role]} backHref="/students" />;
  }

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Import students</h1>
        <p className="text-xs text-muted-foreground">Bulk-create student records from a CSV or spreadsheet export</p>
      </div>

      <ol className="flex items-center gap-1 text-xs">
        {(["upload", "mapping", "review", "complete"] as Step[]).map((s, i) => (
          <li key={s} className={`flex flex-1 items-center gap-1 ${i > 0 ? "before:mr-1 before:h-px before:flex-1 before:bg-border before:content-['']" : ""}`}>
            <span className={`flex size-5 shrink-0 items-center justify-center rounded-pill text-[10px] font-semibold ${step === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground"}`}>
              {i + 1}
            </span>
            <span className="hidden capitalize text-muted-foreground sm:inline">{s}</span>
          </li>
        ))}
      </ol>

      {importError && (
        <div className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error" role="alert">
          {importError}
        </div>
      )}

      {step === "upload" && (
        <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
          <div className="flex flex-col gap-sm rounded-md border border-dashed border-border p-md text-center">
            <FileSpreadsheet className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Upload a CSV file with student records</p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="mx-auto"
            />
          </div>
          <Button variant="outline" className="self-start" onClick={() => downloadTextFile("student-import-template.csv", generateTemplateCsv())}>
            <Download className="size-3.5" />
            Download template
          </Button>
        </div>
      )}

      {step === "mapping" && parsed && (
        <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
          <p className="text-sm text-muted-foreground">
            {parsed.rows.length} rows detected in <span className="font-medium text-foreground">{fileName}</span>. Map each field to a column.
          </p>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            {allFields.map((field) => (
              <div key={field} className="flex items-center gap-sm">
                <span className="w-40 shrink-0 truncate text-xs font-medium text-foreground">
                  {field}
                  {studentImportRequiredFields.includes(field as (typeof studentImportRequiredFields)[number]) && <span className="text-error"> *</span>}
                </span>
                <Select value={mapping[field] || undefined} onValueChange={(v) => setMapping((m) => ({ ...m, [field]: v }))}>
                  <SelectTrigger aria-label={`Map ${field}`}>
                    <SelectValue placeholder="Not mapped" />
                  </SelectTrigger>
                  <SelectContent>
                    {parsed.headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[480px] text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary/60">
                  {parsed.headers.map((h) => (
                    <th key={h} className="px-sm py-1 text-left font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 3).map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {parsed.headers.map((h) => (
                      <td key={h} className="px-sm py-1 text-foreground">
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-sm">
            <Button variant="outline" onClick={reset}>
              Start over
            </Button>
            <Button onClick={runValidation} disabled={studentImportRequiredFields.some((f) => !mapping[f])}>
              Validate
            </Button>
          </div>
        </div>
      )}

      {step === "review" && validation && (
        <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
            <div className="rounded-md border border-success/30 bg-success/10 p-sm text-center">
              <p className="text-xl font-bold text-success">{validation.valid.length}</p>
              <p className="text-xs text-success">Valid rows</p>
            </div>
            <div className="rounded-md border border-error/30 bg-error/10 p-sm text-center">
              <p className="text-xl font-bold text-error">{combinedErrors.length}</p>
              <p className="text-xs text-error">Rows with errors</p>
            </div>
            <div className="rounded-md border border-border p-sm text-center">
              <p className="text-xl font-bold text-foreground">{validation.valid.length + [...new Set(validation.errors.map((e) => e.row))].length}</p>
              <p className="text-xs text-muted-foreground">Total rows</p>
            </div>
          </div>

          {combinedErrors.length > 0 && (
            <div className="flex flex-col gap-sm">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1 text-sm font-semibold text-foreground">
                  <AlertTriangle className="size-4 text-warning" /> Errors — fix all before importing (imports are all-or-nothing)
                </h3>
                {validation.errors.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!parsed) return;
                      const mapped = applyColumnMapping(parsed.rows, mapping);
                      downloadTextFile("rejected-rows.csv", rejectedRowsToCsv(mapped, validation.errors));
                    }}
                  >
                    <Download className="size-3.5" /> Download rejected rows
                  </Button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-secondary/60">
                      <th className="px-sm py-1 text-left font-medium text-muted-foreground">Row</th>
                      <th className="px-sm py-1 text-left font-medium text-muted-foreground">Field</th>
                      <th className="px-sm py-1 text-left font-medium text-muted-foreground">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedErrors.map((e, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-sm py-1 text-foreground">{e.row}</td>
                        <td className="px-sm py-1 text-foreground">{e.field ?? "—"}</td>
                        <td className="px-sm py-1 text-error">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-sm">
            <Button variant="outline" onClick={reset} disabled={importing}>
              Start over
            </Button>
            <Button onClick={runImport} disabled={importing || validation.valid.length === 0 || combinedErrors.length > 0}>
              {importing ? "Importing…" : `Import ${validation.valid.length} record${validation.valid.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      {step === "complete" && (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-border bg-surface p-lg text-center">
          <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">{importedCount} students imported successfully</p>
          <p className="text-xs text-muted-foreground">These records are now stored in the database.</p>
          <div className="mt-sm flex gap-sm">
            <Button asChild>
              <Link href="/students">View students</Link>
            </Button>
            <Button variant="outline" onClick={reset}>
              <Upload className="size-3.5" /> Import another file
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
