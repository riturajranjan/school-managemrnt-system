"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useFeeStructures } from "@/lib/hooks/use-finance";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney } from "@/lib/finance/money";
import { computeAssignmentPreview, confirmAssignment, type AssignmentOptions } from "@/lib/services/fee-assignment-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

function AssignmentsContent() {
  const searchParams = useSearchParams();
  const structures = useFeeStructures();
  const classes = useManagedClasses();
  const db = useSisStore();
  const { can } = usePermissions();
  const canAssign = can("fees.assign");

  const [structureId, setStructureId] = useState(searchParams.get("structureId") ?? "");
  const [classId, setClassId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [optionalComponentIds, setOptionalComponentIds] = useState<Set<string>>(new Set());
  const [prorate, setProrate] = useState(false);
  const [proratedFromDate, setProratedFromDate] = useState("");
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountName, setDiscountName] = useState("Promotional discount");
  const [discountPercent, setDiscountPercent] = useState(10);
  const [outcome, setOutcome] = useState<{ assigned: number; skipped: number } | null>(null);

  const structure = structures.find((s) => s.id === structureId);
  const classStudents = classId ? db.students.filter((s) => s.classId === classId && s.status === "active") : [];

  const options: AssignmentOptions = {
    optionalComponentIds: [...optionalComponentIds],
    proratedFromDate: prorate && proratedFromDate ? proratedFromDate : undefined,
    discountPercent: applyDiscount ? discountPercent : undefined,
    discountName: applyDiscount ? discountName : undefined,
  };

  const preview = structure && selectedStudentIds.size > 0 ? computeAssignmentPreview(db, [...selectedStudentIds], structure, options) : [];
  const eligibleCount = preview.filter((p) => p.eligible).length;
  const exceptionCount = preview.filter((p) => !p.eligible).length;

  function toggleStudent(id: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectWholeClass() {
    setSelectedStudentIds(new Set(classStudents.map((s) => s.id)));
  }

  return (
    <div className="flex flex-col gap-md pb-28 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Fee assignment</h1>
        <p className="text-xs text-muted-foreground">Bill a class or individual students against a fee structure</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">1. Class &amp; students</h2>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div>
            <Label>Class</Label>
            <Select
              value={classId}
              onValueChange={(v) => {
                setClassId(v);
                setSelectedStudentIds(new Set());
              }}
            >
              <SelectTrigger aria-label="Class">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fee structure</Label>
            <Select value={structureId} onValueChange={setStructureId}>
              <SelectTrigger aria-label="Fee structure">
                <SelectValue placeholder="Select structure" />
              </SelectTrigger>
              <SelectContent>
                {structures.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.session})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {classId && (
          <div className="mt-sm">
            <div className="mb-xs flex items-center justify-between">
              <Label className="mb-0">Students ({selectedStudentIds.size} selected)</Label>
              <Button type="button" size="sm" variant="outline" onClick={selectWholeClass}>
                Select whole class
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              {classStudents.map((s) => (
                <label key={s.id} className="flex min-h-11 items-center gap-sm border-b border-border px-sm py-1.5 text-sm last:border-0">
                  <Checkbox checked={selectedStudentIds.has(s.id)} onCheckedChange={() => toggleStudent(s.id)} />
                  <span className="text-foreground">
                    {s.profile.firstName} {s.profile.lastName}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{s.admissionNumber}</span>
                </label>
              ))}
              {classStudents.length === 0 && <p className="p-sm text-sm text-muted-foreground">No active students in this class.</p>}
            </div>
          </div>
        )}
      </div>

      {structure && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">2. Optional fees &amp; adjustments</h2>
          {structure.components.some((c) => c.optional) && (
            <div className="mb-sm">
              <Label>Optional components</Label>
              <div className="flex flex-col gap-1">
                {structure.components
                  .filter((c) => c.optional)
                  .map((c) => (
                    <label key={c.id} className="flex min-h-9 items-center gap-1.5 text-sm text-foreground">
                      <Checkbox
                        checked={optionalComponentIds.has(c.id)}
                        onCheckedChange={(checked) =>
                          setOptionalComponentIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          })
                        }
                      />
                      {c.label} — {formatMoney(c.amount)}
                    </label>
                  ))}
              </div>
            </div>
          )}

          <label className="flex items-center justify-between rounded-md border border-border p-sm">
            <div>
              <p className="text-sm text-foreground">Mid-session admission (prorate)</p>
              <p className="text-xs text-muted-foreground">Waives installments due before the join date</p>
            </div>
            <Switch checked={prorate} onCheckedChange={setProrate} />
          </label>
          {prorate && (
            <div className="mt-sm w-48">
              <Label htmlFor="prorate-date">Joined on</Label>
              <Input id="prorate-date" type="date" value={proratedFromDate} onChange={(e) => setProratedFromDate(e.target.value)} />
            </div>
          )}

          <label className="mt-sm flex items-center justify-between rounded-md border border-border p-sm">
            <div>
              <p className="text-sm text-foreground">Apply a discount to all selected students</p>
              <p className="text-xs text-muted-foreground">Creates an individual discount record per student</p>
            </div>
            <Switch checked={applyDiscount} onCheckedChange={setApplyDiscount} />
          </label>
          {applyDiscount && (
            <div className="mt-sm grid grid-cols-2 gap-sm">
              <div>
                <Label htmlFor="discount-name">Discount name</Label>
                <Input id="discount-name" value={discountName} onChange={(e) => setDiscountName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="discount-percent">Percent</Label>
                <Input id="discount-percent" type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} />
              </div>
            </div>
          )}
        </div>
      )}

      {preview.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">3. Preview &amp; exceptions</h2>
            <div className="flex items-center gap-xs">
              <Badge tone="success">{eligibleCount} eligible</Badge>
              {exceptionCount > 0 && <Badge tone="warning">{exceptionCount} exception{exceptionCount === 1 ? "" : "s"}</Badge>}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {preview.map((row) => (
              <div key={row.studentId} className="flex items-center justify-between gap-sm rounded-md border border-border px-sm py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{row.studentName}</p>
                  {row.exception && (
                    <p className="flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="size-3" /> {row.exception}
                    </p>
                  )}
                </div>
                {row.eligible ? <span className="shrink-0 font-medium text-foreground">{formatMoney(row.total)}</span> : <Badge tone="neutral">Skipped</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {outcome && (
        <div className="flex items-center gap-sm rounded-lg border border-success/30 bg-success/8 p-sm text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          Assigned {outcome.assigned} student{outcome.assigned === 1 ? "" : "s"}
          {outcome.skipped > 0 && ` · skipped ${outcome.skipped}`}.
        </div>
      )}

      {canAssign && structure && preview.length > 0 && (
        <div className="sticky bottom-16 left-0 right-0 flex justify-end rounded-lg border border-border bg-surface p-sm shadow-floating sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <Button
            disabled={eligibleCount === 0}
            onClick={() => {
              const result = confirmAssignment(structure, preview, options, ACTOR);
              setOutcome(result);
              setSelectedStudentIds(new Set());
            }}
          >
            <ClipboardList className="size-3.5" />
            Confirm assignment for {eligibleCount} student{eligibleCount === 1 ? "" : "s"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function FeeAssignmentsPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <AssignmentsContent />
    </Suspense>
  );
}
