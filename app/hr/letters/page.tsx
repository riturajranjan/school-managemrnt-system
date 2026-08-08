"use client";

import { useState } from "react";
import { FileText, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { generateLetter } from "@/lib/services/hr-service";
import { roleLabels } from "@/lib/permissions/roles";
import { letterTypeLabels, type LetterType } from "@/lib/types/hr";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function LettersPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [empId, setEmpId] = useState(db.employees[0]?.id ?? "");
  const [type, setType] = useState<LetterType>("experience");
  const [preview, setPreview] = useState(false);
  const [, force] = useState(0);

  if (!can("hr.view"))
    return (
      <PermissionDenied
        action="view letters"
        role={roleLabels[role]}
        backHref="/hr"
      />
    );
  const canManage = can("hr.manageLetters");
  const me = db.employees.find((e) => e.id === empId);
  const desig =
    db.designations.find((d) => d.id === me?.designationId)?.title ?? "";

  function generate() {
    generateLetter(empId, type, "HR Manager");
    setPreview(true);
    force((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Letters & certificates
        </h1>
        <p className="text-xs text-muted-foreground">
          Generate, preview and print staff letters (frontend simulation — no
          PDF export)
        </p>
      </div>

      {canManage && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">
              Employee
            </label>
            <Select
              value={empId}
              onValueChange={(v) => {
                setEmpId(v);
                setPreview(false);
              }}>
              <SelectTrigger aria-label="Employee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {db.employees.slice(0, 60).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">
              Letter type
            </label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as LetterType);
                setPreview(false);
              }}>
              <SelectTrigger aria-label="Letter type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(letterTypeLabels) as LetterType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {letterTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate}>
            <FileText className="size-4" /> Generate
          </Button>
        </div>
      )}

      {preview && me && (
        <div className="rounded-lg border border-border bg-surface p-lg">
          <div className="mb-md flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {letterTypeLabels[type]} — preview
            </h2>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="size-3.5" /> Print
            </Button>
          </div>
          <div className="mx-auto  space-y-3 rounded-md border border-border bg-background p-lg text-sm leading-relaxed text-foreground">
            <p className="text-center font-semibold">
              Novyra International School
            </p>
            <p className="text-right text-xs text-muted-foreground">
              {formatDate(new Date().toISOString())}
            </p>
            <p className="font-medium">To Whom It May Concern,</p>
            <p>
              This is to certify that{" "}
              <span className="font-semibold">
                {me.firstName} {me.lastName}
              </span>{" "}
              (Employee ID {me.employeeCode}) has been employed with Novyra
              International School as{" "}
              <span className="font-semibold">{desig}</span> since{" "}
              {formatDate(me.joiningDate)}.
            </p>
            <p>
              {type === "experience" || type === "relieving"
                ? "During their tenure, their conduct and performance have been satisfactory."
                : "This letter is issued upon request for official purposes."}
            </p>
            <p className="pt-4">Sincerely,</p>
            <p className="font-medium">
              HR Manager
              <br />
              <span className="text-xs text-muted-foreground">
                Human Resources
              </span>
            </p>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-sm text-sm font-semibold text-foreground">
          Recently generated
        </h2>
        {db.staffLetters.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
            No letters generated yet.
          </p>
        ) : (
          <div className="flex flex-col gap-xs">
            {db.staffLetters.slice(0, 12).map((l) => {
              const e = db.employees.find((x) => x.id === l.employeeId);
              return (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm">
                  <span className="min-w-0 truncate text-foreground">
                    {e ? `${e.firstName} ${e.lastName}` : l.employeeId} ·{" "}
                    {letterTypeLabels[l.type]}
                  </span>
                  <Badge tone="neutral">{formatDateTime(l.generatedAt)}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
