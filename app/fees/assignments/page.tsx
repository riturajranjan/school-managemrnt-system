"use client";

// Real PostgreSQL/API cutover (Phase 9F) — POSTs to /api/fees/assignments.
// Bulk targets (class/section) are resolved server-side to real Enrollment
// rows — this page only ever sends a class/section ID or a single student
// ID, never a student list it assembled itself.
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeeTrail } from "@/components/fees/fee-trail";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useClasses, useSections } from "@/lib/hooks/api/use-academics-foundation";
import { assignFeeStructureRequest, useFeeStructures } from "@/lib/hooks/api/use-fees-api";
import type { AssignFeeStructureResultDto } from "@/lib/api/contracts";
import { roleLabels } from "@/lib/permissions/roles";

function AssignmentsContent() {
  const searchParams = useSearchParams();
  const { data: structures } = useFeeStructures("active");
  const { data: classes } = useClasses();
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("fees.manage");

  const [structureId, setStructureId] = useState(searchParams.get("structureId") ?? "");
  const [targetType, setTargetType] = useState<"class" | "section">("class");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const { data: sections } = useSections(classId || undefined);
  const [result, setResult] = useState<AssignFeeStructureResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;

  if (!canManage) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <ClipboardList className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">You don&apos;t have permission to assign fee structures.</p>
      </div>
    );
  }

  async function handleAssign() {
    setError(null);
    setResult(null);
    if (!structureId) return setError("Select a fee structure.");
    const target = targetType === "class" ? { type: "class" as const, classId } : { type: "section" as const, sectionId };
    if ((targetType === "class" && !classId) || (targetType === "section" && !sectionId)) return setError("Select a target.");

    setSaving(true);
    const res = await assignFeeStructureRequest({ feeStructureId: structureId, target });
    setSaving(false);
    if (!res.success) return setError(res.error.message);
    setResult(res.data);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <FeeTrail items={[{ label: "Fees", href: "/fees" }, { label: "Fee Setup", href: "/fees/setup" }, { label: "Assign Fees to Students" }]} />

      <div>
        <h1 className="text-lg font-semibold text-foreground">Assign Fees to Students</h1>
        <p className="text-xs text-muted-foreground">Choose which students should receive this fee.</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Fee structure</p>
            <Select value={structureId} onValueChange={setStructureId}>
              <SelectTrigger aria-label="Fee structure">
                <SelectValue placeholder="Select structure" />
              </SelectTrigger>
              <SelectContent>
                {structures.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Target</p>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as "class" | "section")}>
              <SelectTrigger aria-label="Target type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="class">Entire class</SelectItem>
                <SelectItem value="section">One section</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Class</p>
            <Select
              value={classId}
              onValueChange={(v) => {
                setClassId(v);
                setSectionId("");
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
          {targetType === "section" && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Section</p>
              <Select value={sectionId} onValueChange={setSectionId} disabled={!classId}>
                <SelectTrigger aria-label="Section">
                  <SelectValue placeholder={classId ? "Select section" : "Select a class first"} />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-sm flex items-center gap-1.5 rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">
            <AlertTriangle className="size-3.5 shrink-0" /> {error}
          </p>
        )}

        <Button className="mt-sm" disabled={saving} onClick={handleAssign}>
          Assign Fees
        </Button>
      </div>

      {result && (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-success/30 bg-success/8 p-lg text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="text-sm font-medium text-foreground">Assignment complete</p>
          <div className="flex gap-sm text-xs text-muted-foreground">
            <Badge tone="success">{result.assigned} newly billed</Badge>
            {result.alreadyAssigned > 0 && <Badge tone="neutral">{result.alreadyAssigned} already assigned</Badge>}
          </div>
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
