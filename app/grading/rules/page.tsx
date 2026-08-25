"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FieldHint, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useGradingSchemes, useResultRules } from "@/lib/hooks/use-exams";
import { createResultRule, deleteResultRule, updateResultRule } from "@/lib/services/grading-service";
import {
  rankInclusionLabels,
  roundingRuleLabels,
  tieBreakerLabels,
  type RankInclusionRule,
  type ResultRule,
  type RoundingRule,
  type TieBreaker,
} from "@/lib/types/grading";

type RuleDraft = Omit<ResultRule, "id" | "createdAt" | "updatedAt">;

function defaultDraft(gradingSchemeId: string): RuleDraft {
  return {
    name: "",
    gradingSchemeId,
    maxFailedSubjects: 2,
    graceMarksLimit: 5,
    rankInclusion: "pass-only",
    bestOfEnabled: false,
    roundingRule: "nearest",
    decimalPrecision: 1,
    tieBreaker: "higher-theory",
  };
}

export default function GradingRulesPage() {
  const rules = useResultRules();
  const schemes = useGradingSchemes();
  const { can } = usePermissions();
  const canManage = can("grading.manage");

  const [editing, setEditing] = useState<ResultRule | RuleDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!can("results.view")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to view grading rules.</p>;
  }

  const schemeName = (id: string) => schemes.find((s) => s.id === id)?.name ?? "—";

  function set<K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) {
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleSave() {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError("Give this rule a name.");
      return;
    }
    if (!editing.gradingSchemeId) {
      setError("Select a grading scheme.");
      return;
    }
    if ("id" in editing) {
      updateResultRule(editing.id, editing);
    } else {
      createResultRule(editing);
    }
    setEditing(null);
    setError(null);
  }

  const columns: ColumnDef<ResultRule>[] = [
    {
      id: "name",
      header: "Rule",
      alwaysVisible: true,
      sortValue: (r) => r.name,
      cell: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{r.name}</p>
          <p className="text-xs text-muted-foreground">{schemeName(r.gradingSchemeId)}</p>
        </div>
      ),
    },
    { id: "maxFailed", header: "Max failed subjects", cell: (r) => <span className="text-sm text-foreground">{r.maxFailedSubjects}</span> },
    { id: "grace", header: "Grace limit", cell: (r) => <span className="text-sm text-foreground">{r.graceMarksLimit}</span> },
    { id: "attendance", header: "Attendance gate", cell: (r) => <span className="text-sm text-foreground">{r.attendanceEligibilityPercent ? `${r.attendanceEligibilityPercent}%` : "None"}</span>, defaultVisible: false },
    { id: "rank", header: "Rank inclusion", cell: (r) => <Badge tone="info">{rankInclusionLabels[r.rankInclusion]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Result rules</h1>
          <p className="text-xs text-muted-foreground">Pass/fail, grace-mark and ranking rules the result engine applies</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setError(null);
              setEditing(defaultDraft(schemes[0]?.id ?? ""));
            }}
          >
            <Plus className="size-3.5" />
            New rule
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rules}
        getRowId={(r) => r.id}
        caption="Result rules"
        onRowClick={
          canManage
            ? (r) => {
                setError(null);
                setEditing(r);
              }
            : undefined
        }
        renderMobileCard={(r) => (
          <button
            type="button"
            onClick={() => {
              if (!canManage) return;
              setError(null);
              setEditing(r);
            }}
            className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
          >
            <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
            <p className="text-xs text-muted-foreground">{schemeName(r.gradingSchemeId)} · Max {r.maxFailedSubjects} fail</p>
          </button>
        )}
        emptyTitle="No result rules yet"
      />

      <DetailDrawer
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing && "id" in editing ? "Edit result rule" : "New result rule"}
        description="Applied by the result-calculation engine — changes only affect future calculations"
      >
        {editing && (
          <div className="flex flex-col gap-sm">
            {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}

            <div>
              <Label htmlFor="rule-name">Rule name</Label>
              <Input id="rule-name" value={editing.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Standard Secondary Rules" />
            </div>

            <div>
              <Label>Grading scheme</Label>
              <Select value={editing.gradingSchemeId} onValueChange={(v) => set("gradingSchemeId", v)}>
                <SelectTrigger aria-label="Grading scheme">
                  <SelectValue placeholder="Select scheme" />
                </SelectTrigger>
                <SelectContent>
                  {schemes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label htmlFor="min-overall">Minimum overall %</Label>
                <Input id="min-overall" type="number" value={editing.minOverallPercent ?? ""} onChange={(e) => set("minOverallPercent", e.target.value === "" ? undefined : Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="max-failed">Max failed subjects</Label>
                <Input id="max-failed" type="number" value={editing.maxFailedSubjects} onChange={(e) => set("maxFailedSubjects", Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="min-theory">Minimum theory %</Label>
                <Input id="min-theory" type="number" value={editing.minTheoryPercent ?? ""} onChange={(e) => set("minTheoryPercent", e.target.value === "" ? undefined : Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="min-practical">Minimum practical %</Label>
                <Input id="min-practical" type="number" value={editing.minPracticalPercent ?? ""} onChange={(e) => set("minPracticalPercent", e.target.value === "" ? undefined : Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="grace-limit">Grace-mark limit</Label>
                <Input id="grace-limit" type="number" value={editing.graceMarksLimit} onChange={(e) => set("graceMarksLimit", Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="attendance-gate">Attendance eligibility %</Label>
                <Input id="attendance-gate" type="number" value={editing.attendanceEligibilityPercent ?? ""} onChange={(e) => set("attendanceEligibilityPercent", e.target.value === "" ? undefined : Number(e.target.value))} />
                <FieldHint>Blank = no attendance gate</FieldHint>
              </div>
            </div>

            <div>
              <Label>Rank inclusion</Label>
              <Select value={editing.rankInclusion} onValueChange={(v) => set("rankInclusion", v as RankInclusionRule)}>
                <SelectTrigger aria-label="Rank inclusion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(rankInclusionLabels) as RankInclusionRule[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {rankInclusionLabels[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label>Rounding</Label>
                <Select value={editing.roundingRule} onValueChange={(v) => set("roundingRule", v as RoundingRule)}>
                  <SelectTrigger aria-label="Rounding rule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(roundingRuleLabels) as RoundingRule[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {roundingRuleLabels[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="decimals">Decimal precision</Label>
                <Input id="decimals" type="number" min={0} max={3} value={editing.decimalPrecision} onChange={(e) => set("decimalPrecision", Number(e.target.value))} />
              </div>
            </div>

            <div>
              <Label>Tie-breaker</Label>
              <Select value={editing.tieBreaker} onValueChange={(v) => set("tieBreaker", v as TieBreaker)}>
                <SelectTrigger aria-label="Tie-breaker">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(tieBreakerLabels) as TieBreaker[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {tieBreakerLabels[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-sm">
              <div>
                <p className="text-sm font-medium text-foreground">Best-of subjects</p>
                <p className="text-xs text-muted-foreground">Count only the top N subjects toward the overall result</p>
              </div>
              <Switch checked={editing.bestOfEnabled} onCheckedChange={(checked) => set("bestOfEnabled", checked)} />
            </div>
            {editing.bestOfEnabled && (
              <div>
                <Label htmlFor="best-of-count">Number of subjects to count</Label>
                <Input id="best-of-count" type="number" value={editing.bestOfCount ?? ""} onChange={(e) => set("bestOfCount", e.target.value === "" ? undefined : Number(e.target.value))} />
              </div>
            )}

            <div className="flex items-center gap-sm">
              <Button onClick={handleSave} className="flex-1">
                {"id" in editing ? "Save changes" : "Create rule"}
              </Button>
              {"id" in editing && (
                <Button
                  variant="outline"
                  className="text-error"
                  onClick={() => {
                    const result = deleteResultRule(editing.id);
                    if (!result.ok) setError(result.error);
                    else setEditing(null);
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
