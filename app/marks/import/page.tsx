"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExam, useExams, useExamSubjects } from "@/lib/hooks/use-exams";
import { parseCsvText, type ParsedCsv } from "@/lib/services/import-service";
import { applyMarksColumnMapping, commitMarksImport, generateMarksTemplateCsv, rejectedMarksRowsToCsv, validateMarksRows, type MappedMarksRow } from "@/lib/services/marks-import-service";
import { subjectById } from "@/lib/data/seed/academics";
import { marksImportOptionalFields, marksImportRequiredFields } from "@/lib/types/import";
import { downloadTextFile } from "@/lib/utils";

type Step = "upload" | "mapping" | "review" | "complete";
const allFields = [...marksImportRequiredFields, ...marksImportOptionalFields];
const ACTOR = { name: "Examination Controller", role: "Examination Controller" };

function MarksImportContent() {
  const searchParams = useSearchParams();
  const exams = useExams();
  const classes = useManagedClasses();
  const { can } = usePermissions();

  const [examId, setExamId] = useState(searchParams.get("examId") ?? "");
  const examSubjects = useExamSubjects(examId);
  const scheduled = examSubjects.filter((s) => s.date);
  const [examSubjectId, setExamSubjectId] = useState(searchParams.get("examSubjectId") ?? "");
  const exam = useExam(examId);
  const examSubject = examSubjects.find((s) => s.id === examSubjectId);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<{ valid: MappedMarksRow[]; errors: ReturnType<typeof validateMarksRows>["errors"] } | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  if (!can("marks.import")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to import marks.</p>;
  }

  const relevantFields = allFields.filter((f) => {
    if (!examSubject) return true;
    if (f === "theory") return examSubject.theoryMarks > 0;
    if (f === "practical") return examSubject.practicalMarks > 0;
    if (f === "internal") return examSubject.internalMarks > 0;
    if (f === "project") return examSubject.projectMarks > 0;
    return true;
  });

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const result = parseCsvText(text);
      setParsed(result);
      const autoMapping: Record<string, string> = {};
      for (const field of relevantFields) {
        const match = result.headers.find((h) => h.toLowerCase().replace(/[\s_]/g, "") === field.toLowerCase());
        if (match) autoMapping[field] = match;
      }
      setMapping(autoMapping);
      setStep("mapping");
    };
    reader.readAsText(file);
  }

  function runValidation() {
    if (!parsed || !examSubject) return;
    const mapped = applyMarksColumnMapping(parsed.rows, mapping);
    setValidation(validateMarksRows(mapped, examSubject));
    setStep("review");
  }

  function runImport() {
    if (!validation || !examSubject) return;
    const count = commitMarksImport(examId, examSubject, validation.valid, ACTOR);
    setImportedCount(count);
    setStep("complete");
  }

  function reset() {
    setStep("upload");
    setFileName("");
    setParsed(null);
    setMapping({});
    setValidation(null);
    setImportedCount(0);
  }

  const subject = examSubject ? subjectById(examSubject.subjectId) : undefined;
  const schoolClass = examSubject ? classes.find((c) => c.id === examSubject.classId) : undefined;
  const section = schoolClass?.sections.find((s) => s.id === examSubject?.sectionId);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Import marks</h1>
        <p className="text-xs text-muted-foreground">Bulk-load marks from a spreadsheet export, matched by admission number</p>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Select value={examId} onValueChange={(v) => { setExamId(v); setExamSubjectId(""); reset(); }}>
          <SelectTrigger className="w-56" aria-label="Exam">
            <SelectValue placeholder="Select exam" />
          </SelectTrigger>
          <SelectContent>
            {exams.filter((e) => e.status !== "draft").map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={examSubjectId} onValueChange={(v) => { setExamSubjectId(v); reset(); }} disabled={!examId}>
          <SelectTrigger className="w-64" aria-label="Class, section and subject">
            <SelectValue placeholder="Select class, section, subject" />
          </SelectTrigger>
          <SelectContent>
            {scheduled.map((s) => {
              const subj = subjectById(s.subjectId);
              const cls = classes.find((c) => c.id === s.classId);
              const sec = cls?.sections.find((sec) => sec.id === s.sectionId);
              return (
                <SelectItem key={s.id} value={s.id}>
                  {cls?.name}-{sec?.name} · {subj?.name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {!examSubject ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Select an exam and subject to begin.</p>
      ) : (
        <>
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

          <p className="text-xs text-muted-foreground">
            {exam?.name} · {schoolClass?.name}-{section?.name} · {subject?.name}
          </p>

          {step === "upload" && (
            <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
              <div className="flex flex-col gap-sm rounded-md border border-dashed border-border p-md text-center">
                <FileSpreadsheet className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Upload a CSV file of marks for this subject</p>
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
              <Button variant="outline" className="self-start" onClick={() => downloadTextFile(`marks-template-${examSubject.id}.csv`, generateMarksTemplateCsv(examSubject))}>
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
                {relevantFields.map((field) => (
                  <div key={field} className="flex items-center gap-sm">
                    <span className="w-32 shrink-0 truncate text-xs font-medium text-foreground">
                      {field}
                      {marksImportRequiredFields.includes(field as (typeof marksImportRequiredFields)[number]) && <span className="text-error"> *</span>}
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
                <Button onClick={runValidation} disabled={marksImportRequiredFields.some((f) => !mapping[f])}>
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
                  <p className="text-xl font-bold text-error">{[...new Set(validation.errors.map((e) => e.row))].length}</p>
                  <p className="text-xs text-error">Rows with errors</p>
                </div>
                <div className="rounded-md border border-border p-sm text-center">
                  <p className="text-xl font-bold text-foreground">{validation.valid.length + [...new Set(validation.errors.map((e) => e.row))].length}</p>
                  <p className="text-xs text-muted-foreground">Total rows</p>
                </div>
              </div>

              {validation.errors.length > 0 && (
                <div className="flex flex-col gap-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1 text-sm font-semibold text-foreground">
                      <AlertTriangle className="size-4 text-warning" /> Errors
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!parsed) return;
                        const mapped = applyMarksColumnMapping(parsed.rows, mapping);
                        downloadTextFile("rejected-marks-rows.csv", rejectedMarksRowsToCsv(mapped, validation.errors));
                      }}
                    >
                      <Download className="size-3.5" /> Download rejected rows
                    </Button>
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
                        {validation.errors.map((e, i) => (
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
                <Button variant="outline" onClick={reset}>
                  Start over
                </Button>
                <Button onClick={runImport} disabled={validation.valid.length === 0}>
                  Import {validation.valid.length} valid row{validation.valid.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          )}

          {step === "complete" && (
            <div className="flex flex-col items-center gap-sm rounded-lg border border-border bg-surface p-lg text-center">
              <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">{importedCount} marks imported</p>
              {validation && validation.errors.length > 0 && <Badge tone="warning">{[...new Set(validation.errors.map((e) => e.row))].length} rows skipped — see the downloaded report</Badge>}
              <div className="mt-sm flex gap-sm">
                <Button variant="outline" onClick={reset}>
                  <Upload className="size-3.5" /> Import another file
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MarksImportPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <MarksImportContent />
    </Suspense>
  );
}
