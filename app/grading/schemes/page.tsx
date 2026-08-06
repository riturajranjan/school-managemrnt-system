"use client";

import { useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useGradingSchemes } from "@/lib/hooks/use-exams";
import { createGradingScheme, saveGradeRanges } from "@/lib/services/grading-service";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { gradingSystemLabels, type GradeRange, type GradingScheme, type GradingSystem } from "@/lib/types/grading";
import { cn } from "@/lib/utils";

const systemOptions: GradingSystem[] = ["percentage", "letter", "gpa", "cgpa", "marks-based", "skill", "competency", "pass-fail", "descriptive", "custom"];

function blankRange(): Omit<GradeRange, "id"> {
  return { name: "", minPercent: 0, maxPercent: 0, color: "#18b0c8", isPass: true, order: 1 };
}

export default function GradingSchemesPage() {
  const schemes = useGradingSchemes();
  const classes = useManagedClasses();
  const { can } = usePermissions();
  const canManage = can("grading.manage");

  const [createOpen, setCreateOpen] = useState(false);
  const [editScheme, setEditScheme] = useState<GradingScheme | null>(null);
  const [name, setName] = useState("");
  const [system, setSystem] = useState<GradingSystem>("letter");
  const [classIds, setClassIds] = useState<string[]>([]);

  const [ranges, setRanges] = useState<Omit<GradeRange, "id">[]>([]);
  const [rangeErrors, setRangeErrors] = useState<string[]>([]);

  function openEdit(scheme: GradingScheme) {
    setEditScheme(scheme);
    setRanges(scheme.ranges.map(({ id: _id, ...rest }) => rest));
    setRangeErrors([]);
  }

  function addRange() {
    setRanges((prev) => [...prev, blankRange()]);
  }

  function updateRange(index: number, patch: Partial<Omit<GradeRange, "id">>) {
    setRanges((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRange(index: number) {
    setRanges((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSaveRanges() {
    if (!editScheme) return;
    const result = saveGradeRanges(editScheme.id, ranges);
    if (!result.valid) {
      setRangeErrors(result.errors);
      return;
    }
    setRangeErrors([]);
    setEditScheme(null);
  }

  const columns: ColumnDef<GradingScheme>[] = [
    {
      id: "name",
      header: "Scheme",
      alwaysVisible: true,
      sortValue: (s) => s.name,
      cell: (s) => (
        <div>
          <p className="text-sm font-medium text-foreground">{s.name}</p>
          <p className="text-xs text-muted-foreground">{s.ranges.length} grade band{s.ranges.length === 1 ? "" : "s"}</p>
        </div>
      ),
    },
    { id: "system", header: "System", cell: (s) => <Badge tone="info">{gradingSystemLabels[s.system]}</Badge> },
    {
      id: "classes",
      header: "Applies to",
      cell: (s) => <span className="text-sm text-foreground">{s.applicableClassIds.length === 0 ? "All classes" : `${s.applicableClassIds.length} class(es)`}</span>,
    },
    { id: "session", header: "Session", cell: (s) => <span className="text-sm text-muted-foreground">{s.session}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (s) => <Badge tone={s.status === "active" ? "success" : s.status === "draft" ? "neutral" : "warning"}>{s.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Grading schemes</h1>
          <p className="text-xs text-muted-foreground">Grade bands used to convert marks into grades across exams</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setName("");
              setSystem("letter");
              setClassIds([]);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            New scheme
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={schemes}
        getRowId={(s) => s.id}
        caption="Grading schemes"
        onRowClick={canManage ? openEdit : undefined}
        renderMobileCard={(s) => (
          <button
            type="button"
            onClick={() => canManage && openEdit(s)}
            className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
              <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {gradingSystemLabels[s.system]} · {s.ranges.length} bands
            </p>
          </button>
        )}
        emptyTitle="No grading schemes yet"
      />

      <DetailDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New grading scheme"
        description="Define grade bands after creating the scheme"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const scheme = createGradingScheme({ name: name.trim(), system, session: CURRENT_SESSION, applicableClassIds: classIds, applicableSubjectIds: [], status: "draft" });
            setCreateOpen(false);
            openEdit(scheme);
          }}
          className="flex flex-col gap-sm"
        >
          <div>
            <Label htmlFor="scheme-name">Scheme name</Label>
            <Input id="scheme-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CBSE Pattern (Secondary)" />
          </div>
          <div>
            <Label>Grading system</Label>
            <Select value={system} onValueChange={(v) => setSystem(v as GradingSystem)}>
              <SelectTrigger aria-label="Grading system">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {systemOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {gradingSystemLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Applicable classes</Label>
            <p className="mb-xs text-xs text-muted-foreground">Leave all unchecked to apply to every class.</p>
            <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-border p-sm sm:grid-cols-3">
              {classes.map((c) => (
                <label key={c.id} className="flex min-h-9 items-center gap-1.5 text-sm text-foreground">
                  <Checkbox
                    checked={classIds.includes(c.id)}
                    onCheckedChange={(checked) => setClassIds((prev) => (checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={!name.trim()}>
            Create &amp; add grade bands
          </Button>
        </form>
      </DetailDrawer>

      <DetailDrawer
        open={editScheme !== null}
        onOpenChange={(open) => !open && setEditScheme(null)}
        title={editScheme?.name ?? ""}
        description={editScheme ? `${gradingSystemLabels[editScheme.system]} · Grade bands` : ""}
      >
        {editScheme && (
          <div className="flex flex-col gap-md">
            {rangeErrors.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">
                <p className="flex items-center gap-1 font-medium">
                  <AlertTriangle className="size-3.5" /> Fix these before saving
                </p>
                {rangeErrors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-sm">
              {ranges.map((range, index) => (
                <div key={index} className="flex flex-col gap-xs rounded-md border border-border p-sm">
                  <div className="flex items-center gap-xs">
                    <Input
                      value={range.name}
                      onChange={(e) => updateRange(index, { name: e.target.value })}
                      placeholder="Grade name"
                      className="flex-1"
                      aria-label={`Grade ${index + 1} name`}
                    />
                    <Input
                      type="color"
                      value={range.color}
                      onChange={(e) => updateRange(index, { color: e.target.value })}
                      className="h-11 w-12 shrink-0 p-1 sm:h-9"
                      aria-label={`Grade ${index + 1} colour`}
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeRange(index)} aria-label={`Remove grade ${index + 1}`}>
                      <Trash2 className="size-3.5 text-error" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-xs">
                    <div>
                      <Label htmlFor={`min-${index}`} className="text-[11px]">
                        Min %
                      </Label>
                      <Input id={`min-${index}`} type="number" value={range.minPercent} onChange={(e) => updateRange(index, { minPercent: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label htmlFor={`max-${index}`} className="text-[11px]">
                        Max %
                      </Label>
                      <Input id={`max-${index}`} type="number" value={range.maxPercent} onChange={(e) => updateRange(index, { maxPercent: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label htmlFor={`gp-${index}`} className="text-[11px]">
                        Grade point
                      </Label>
                      <Input
                        id={`gp-${index}`}
                        type="number"
                        value={range.gradePoint ?? ""}
                        onChange={(e) => updateRange(index, { gradePoint: e.target.value === "" ? undefined : Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox checked={range.isPass} onCheckedChange={(checked) => updateRange(index, { isPass: checked === true })} />
                    Counts as a pass
                  </label>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addRange} className="self-start">
                <Plus className="size-3.5" />
                Add grade band
              </Button>
            </div>

            <div className="flex flex-wrap gap-1">
              {[...ranges]
                .sort((a, b) => b.minPercent - a.minPercent)
                .map((r, i) => (
                  <span
                    key={i}
                    className={cn("rounded-pill px-sm py-1 text-xs font-medium")}
                    style={{ backgroundColor: `${r.color}22`, color: r.color }}
                  >
                    {r.name || "—"} {r.minPercent}-{r.maxPercent}%
                  </span>
                ))}
            </div>

            <Button onClick={handleSaveRanges}>Save grade bands</Button>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
