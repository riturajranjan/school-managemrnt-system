"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Copy,
  Layers,
  Plus,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { GradeScaleStrip } from "@/components/grading/grade-scale-strip";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useGradingSchemes } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import {
  archiveGradingScheme,
  assignSchemeClasses,
  createGradingScheme,
  duplicateGradingScheme,
  saveGradeRanges,
  setDefaultGradingScheme,
  unarchiveGradingScheme,
} from "@/lib/services/grading-service";
import {
  computeClassesWithoutScheme,
  detectSchemeIssues,
  schemeUsageCount,
} from "@/lib/selectors/grading-validation";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import {
  gradingSystemLabels,
  type GradeRange,
  type GradingScheme,
  type GradingSystem,
} from "@/lib/types/grading";
import { cn, formatDate } from "@/lib/utils";

const systemOptions: GradingSystem[] = [
  "percentage",
  "letter",
  "gpa",
  "cgpa",
  "marks-based",
  "skill",
  "competency",
  "pass-fail",
  "descriptive",
  "custom",
];

function blankRange(): Omit<GradeRange, "id"> {
  return {
    name: "",
    minPercent: 0,
    maxPercent: 0,
    color: "#18b0c8",
    isPass: true,
    order: 1,
  };
}

export default function GradingSchemesPage() {
  const schemes = useGradingSchemes();
  const classes = useManagedClasses();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("grading.manage");

  const [createOpen, setCreateOpen] = useState(false);
  const [editScheme, setEditScheme] = useState<GradingScheme | null>(null);
  const [assignScheme, setAssignScheme] = useState<GradingScheme | null>(null);
  const [assignClassIds, setAssignClassIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [system, setSystem] = useState<GradingSystem>("letter");
  const [classIds, setClassIds] = useState<string[]>([]);

  const [ranges, setRanges] = useState<Omit<GradeRange, "id">[]>([]);
  const [rangeErrors, setRangeErrors] = useState<string[]>([]);

  const classesWithoutScheme = useMemo(
    () => computeClassesWithoutScheme(db),
    [db],
  );
  const schemeIssues = useMemo(
    () => new Map(schemes.map((s) => [s.id, detectSchemeIssues(s.ranges)])),
    [schemes],
  );
  const totalIssueCount =
    [...schemeIssues.values()].reduce((sum, issues) => sum + issues.length, 0) +
    classesWithoutScheme.length;

  function openEdit(scheme: GradingScheme) {
    setEditScheme(scheme);
    setRanges(scheme.ranges.map(({ id: _id, ...rest }) => rest));
    setRangeErrors([]);
  }

  function addRange() {
    setRanges((prev) => [...prev, blankRange()]);
  }

  function updateRange(index: number, patch: Partial<Omit<GradeRange, "id">>) {
    setRanges((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
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

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Grading schemes
          </h1>
          <p className="text-xs text-muted-foreground">
            Grade bands used to convert marks into grades across exams
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setName("");
              setSystem("letter");
              setClassIds([]);
              setCreateOpen(true);
            }}>
            <Plus className="size-3.5" />
            New scheme
          </Button>
        )}
      </div>

      {totalIssueCount > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-warning/30 bg-warning/8 p-sm text-xs text-warning">
          <p className="flex items-center gap-1 font-medium">
            <AlertTriangle className="size-3.5" /> {totalIssueCount}{" "}
            configuration issue{totalIssueCount === 1 ? "" : "s"} across your
            grading setup
          </p>
          {classesWithoutScheme.length > 0 && (
            <p>
              {classesWithoutScheme.length} class
              {classesWithoutScheme.length === 1 ? "" : "es"} without an active
              scheme: {classesWithoutScheme.map((c) => c.className).join(", ")}
            </p>
          )}
        </div>
      )}

      {schemes.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
            <Layers className="size-5" />
          </span>
          <div className="mx-auto flex  flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">
              No grading schemes yet
            </p>
            <p className="text-sm text-muted-foreground">
              Create a scheme and define its grade bands to start calculating
              results.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
          {schemes.map((s) => {
            const issues = schemeIssues.get(s.id) ?? [];
            const usage = schemeUsageCount(db, s);
            return (
              <div
                key={s.id}
                className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
                <div className="flex items-start justify-between gap-sm">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                      {s.isDefault && (
                        <Star className="size-3.5 shrink-0 fill-warning text-warning" />
                      )}
                      {s.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {gradingSystemLabels[s.system]} · {s.ranges.length} band
                      {s.ranges.length === 1 ? "" : "s"} · {s.session}
                    </p>
                  </div>
                  <Badge
                    tone={
                      s.status === "active"
                        ? "success"
                        : s.status === "draft"
                          ? "neutral"
                          : "warning"
                    }>
                    {s.status}
                  </Badge>
                </div>

                <GradeScaleStrip ranges={s.ranges} />

                {issues.length > 0 && (
                  <div className="flex flex-col gap-0.5 rounded-md border border-warning/30 bg-warning/8 px-sm py-1.5 text-xs text-warning">
                    {issues.slice(0, 3).map((issue, i) => (
                      <span key={i} className="flex items-start gap-1">
                        <AlertTriangle className="mt-0.5 size-3 shrink-0" />{" "}
                        {issue.message}
                      </span>
                    ))}
                    {issues.length > 3 && (
                      <span>+{issues.length - 3} more</span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-sm text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Applies to</p>
                    <p className="font-medium text-foreground">
                      {s.applicableClassIds.length === 0
                        ? "All classes"
                        : `${s.applicableClassIds.length} class(es)`}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Usage</p>
                    <p className="flex items-center gap-1 font-medium text-foreground">
                      <Users className="size-3" /> {usage} exam
                      {usage === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <p className="text-muted-foreground">Last updated</p>
                    <p className="font-medium text-foreground">
                      {formatDate(s.updatedAt)}
                    </p>
                  </div>
                </div>

                {canManage && (
                  <div className="flex flex-wrap items-center gap-xs border-t border-border pt-sm">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(s)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAssignScheme(s);
                        setAssignClassIds(s.applicableClassIds);
                      }}>
                      <Users className="size-3.5" />
                      Assign
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => duplicateGradingScheme(s.id)}>
                      <Copy className="size-3.5" />
                      Duplicate
                    </Button>
                    {!s.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDefaultGradingScheme(s.id)}>
                        <Star className="size-3.5" />
                        Set default
                      </Button>
                    )}
                    {s.status === "archived" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => unarchiveGradingScheme(s.id)}>
                        <ArchiveRestore className="size-3.5" />
                        Restore
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-error"
                        onClick={() => archiveGradingScheme(s.id)}>
                        <Archive className="size-3.5" />
                        Archive
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DetailDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New grading scheme"
        description="Define grade bands after creating the scheme">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const scheme = createGradingScheme({
              name: name.trim(),
              system,
              session: CURRENT_SESSION,
              applicableClassIds: classIds,
              applicableSubjectIds: [],
              status: "draft",
            });
            setCreateOpen(false);
            openEdit(scheme);
          }}
          className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="scheme-name">Scheme name</Label>
            <Input
              id="scheme-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CBSE Pattern (Secondary)"
            />
          </div>
          <div>
            <Label>Grading system</Label>
            <Select
              value={system}
              onValueChange={(v) => setSystem(v as GradingSystem)}>
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
            <p className="mb-xs text-xs text-muted-foreground">
              Leave all unchecked to apply to every class.
            </p>
            <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-border p-sm sm:grid-cols-3">
              {classes.map((c) => (
                <label
                  key={c.id}
                  className="flex min-h-9 items-center gap-1.5 text-sm text-foreground">
                  <Checkbox
                    checked={classIds.includes(c.id)}
                    onCheckedChange={(checked) =>
                      setClassIds((prev) =>
                        checked
                          ? [...prev, c.id]
                          : prev.filter((id) => id !== c.id),
                      )
                    }
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
        open={assignScheme !== null}
        onOpenChange={(open) => !open && setAssignScheme(null)}
        title={assignScheme ? `Assign classes — ${assignScheme.name}` : ""}
        description="Leave all unchecked to apply this scheme to every class">
        {assignScheme && (
          <div className="flex flex-col gap-sm">
            <div className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-border p-sm sm:grid-cols-3">
              {classes.map((c) => (
                <label
                  key={c.id}
                  className="flex min-h-9 items-center gap-1.5 text-sm text-foreground">
                  <Checkbox
                    checked={assignClassIds.includes(c.id)}
                    onCheckedChange={(checked) =>
                      setAssignClassIds((prev) =>
                        checked
                          ? [...prev, c.id]
                          : prev.filter((id) => id !== c.id),
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <Button
              onClick={() => {
                assignSchemeClasses(assignScheme.id, assignClassIds);
                setAssignScheme(null);
              }}>
              Save class assignment
            </Button>
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer
        open={editScheme !== null}
        onOpenChange={(open) => !open && setEditScheme(null)}
        title={editScheme?.name ?? ""}
        description={
          editScheme
            ? `${gradingSystemLabels[editScheme.system]} · Grade bands`
            : ""
        }>
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
                <div
                  key={index}
                  className="flex flex-col gap-xs rounded-md border border-border p-sm">
                  <div className="flex items-center gap-xs">
                    <Input
                      value={range.name}
                      onChange={(e) =>
                        updateRange(index, { name: e.target.value })
                      }
                      placeholder="Grade name"
                      className="flex-1"
                      aria-label={`Grade ${index + 1} name`}
                    />
                    <Input
                      type="color"
                      value={range.color}
                      onChange={(e) =>
                        updateRange(index, { color: e.target.value })
                      }
                      className="h-11 w-12 shrink-0 p-1 sm:h-9"
                      aria-label={`Grade ${index + 1} colour`}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeRange(index)}
                      aria-label={`Remove grade ${index + 1}`}>
                      <Trash2 className="size-3.5 text-error" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-xs">
                    <div>
                      <Label htmlFor={`min-${index}`} className="text-[11px]">
                        Min %
                      </Label>
                      <Input
                        id={`min-${index}`}
                        type="number"
                        value={range.minPercent}
                        onChange={(e) =>
                          updateRange(index, {
                            minPercent: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`max-${index}`} className="text-[11px]">
                        Max %
                      </Label>
                      <Input
                        id={`max-${index}`}
                        type="number"
                        value={range.maxPercent}
                        onChange={(e) =>
                          updateRange(index, {
                            maxPercent: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`gp-${index}`} className="text-[11px]">
                        Grade point
                      </Label>
                      <Input
                        id={`gp-${index}`}
                        type="number"
                        value={range.gradePoint ?? ""}
                        onChange={(e) =>
                          updateRange(index, {
                            gradePoint:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      checked={range.isPass}
                      onCheckedChange={(checked) =>
                        updateRange(index, { isPass: checked === true })
                      }
                    />
                    Counts as a pass
                  </label>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRange}
                className="self-start">
                <Plus className="size-3.5" />
                Add grade band
              </Button>
            </div>

            <div>
              <p className="mb-xs text-xs font-semibold text-foreground">
                Preview
              </p>
              <GradeScaleStrip
                ranges={ranges.map((r, i) => ({ ...r, id: String(i) }))}
              />
              <div className="mt-xs flex flex-wrap gap-1">
                {[...ranges]
                  .sort((a, b) => b.minPercent - a.minPercent)
                  .map((r, i) => (
                    <span
                      key={i}
                      className={cn(
                        "rounded-pill px-sm py-1 text-xs font-medium",
                      )}
                      style={{
                        backgroundColor: `${r.color}22`,
                        color: r.color,
                      }}>
                      {r.name || "—"} {r.minPercent}-{r.maxPercent}%
                    </span>
                  ))}
              </div>
              {detectSchemeIssues(
                ranges.map((r, i) => ({ ...r, id: String(i) })),
              ).length > 0 && (
                <div className="mt-xs flex flex-col gap-0.5 text-xs text-warning">
                  {detectSchemeIssues(
                    ranges.map((r, i) => ({ ...r, id: String(i) })),
                  ).map((issue, i) => (
                    <span key={i} className="flex items-start gap-1">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />{" "}
                      {issue.message}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleSaveRanges}>Save grade bands</Button>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
