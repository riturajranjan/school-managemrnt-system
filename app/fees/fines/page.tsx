"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Plus, RefreshCcw, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useLateFeeRules } from "@/lib/hooks/use-finance";
import { useStudents } from "@/lib/hooks/use-students";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, moneyFromMajor } from "@/lib/finance/money";
import { calculateLateFee, createLateFeeRule, recalculateLateFees, setLateFeeRuleStatus, waiveFine, type LateFeeRuleDraft } from "@/lib/services/late-fee-service";
import { lateFeeCalcTypeLabels, type LateFeeCalcType } from "@/lib/types/fees";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };
const calcTypeOptions = Object.keys(lateFeeCalcTypeLabels) as LateFeeCalcType[];

function blankDraft(): LateFeeRuleDraft {
  return { name: "", calcType: "fixed", amount: moneyFromMajor(200, "INR"), gracePeriodDays: 10, applicableComponentIds: [], applicableClassIds: [] };
}

export default function LateFeesPage() {
  const rules = useLateFeeRules();
  const students = useStudents();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("fees.manageLateFees");

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<LateFeeRuleDraft>(blankDraft());
  const [waiveTarget, setWaiveTarget] = useState<string | null>(null);
  const [waiveAmount, setWaiveAmount] = useState("");
  const [waiveReason, setWaiveReason] = useState("");

  function studentName(id: string) {
    const s = students.find((st) => st.id === id);
    return s ? `${s.profile.firstName} ${s.profile.lastName}` : id;
  }

  const finedItems = db.studentFeeItems.filter((i) => i.fineAmount.minorUnits > 0);
  const previewOverdue = db.studentFeeItems.find((i) => i.status === "overdue");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Late fees</h1>
          <p className="text-xs text-muted-foreground">Configurable fine rules applied to overdue installments</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-xs">
            <Button size="sm" variant="outline" onClick={() => recalculateLateFees(ACTOR)}>
              <RefreshCcw className="size-3.5" />
              Recalculate all
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setDraft(blankDraft());
                setCreateOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              New rule
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
        {rules.map((rule) => {
          const preview = previewOverdue ? calculateLateFee(rule, previewOverdue) : null;
          return (
            <div key={rule.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {lateFeeCalcTypeLabels[rule.calcType]} · {rule.gracePeriodDays}d grace
                  </p>
                </div>
                <Badge tone={rule.status === "active" ? "success" : "neutral"}>{rule.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-sm text-xs">
                <div>
                  <p className="text-muted-foreground">Rate</p>
                  <p className="font-medium text-foreground">{rule.amount ? formatMoney(rule.amount) : rule.percent ? `${rule.percent}%` : rule.calcType === "slab" ? `${rule.slabs?.length ?? 0} slabs` : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cap</p>
                  <p className="font-medium text-foreground">{rule.maxCapAmount ? formatMoney(rule.maxCapAmount) : "None"}</p>
                </div>
              </div>
              {preview && (
                <p className="text-xs text-muted-foreground">
                  Preview on a currently overdue item: <span className="font-medium text-foreground">{formatMoney(preview)}</span>
                </p>
              )}
              {canManage && (
                <div className="flex items-center gap-xs border-t border-border pt-sm">
                  {rule.status === "active" ? (
                    <Button size="sm" variant="outline" onClick={() => setLateFeeRuleStatus(rule.id, "inactive", ACTOR)}>
                      <Archive className="size-3.5" />
                      Deactivate
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setLateFeeRuleStatus(rule.id, "active", ACTOR)}>
                      <ArchiveRestore className="size-3.5" />
                      Activate
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {rules.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
              <Scale className="size-5" />
            </span>
            <p className="text-sm text-muted-foreground">No late-fee rules configured.</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Currently fined items ({finedItems.length})</h2>
        {finedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fines currently applied.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {finedItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-sm rounded-md border border-border px-sm py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{studentName(item.studentId)}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.label} · Due {formatDate(item.dueDate)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-sm">
                  <span className="font-medium text-error">{formatMoney(item.fineAmount)}</span>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setWaiveTarget(item.id);
                        setWaiveAmount("");
                        setWaiveReason("");
                      }}
                    >
                      Waive
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New late-fee rule" description="Applied to overdue installments once the grace period elapses">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="lfr-name">Rule name</Label>
            <Input id="lfr-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label>Calculation</Label>
              <Select value={draft.calcType} onValueChange={(v) => setDraft((d) => ({ ...d, calcType: v as LateFeeCalcType }))}>
                <SelectTrigger aria-label="Calculation type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {calcTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {lateFeeCalcTypeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lfr-grace">Grace period (days)</Label>
              <Input id="lfr-grace" type="number" min={0} value={draft.gracePeriodDays} onChange={(e) => setDraft((d) => ({ ...d, gracePeriodDays: Number(e.target.value) }))} />
            </div>
          </div>
          {draft.calcType === "percentage" ? (
            <div>
              <Label htmlFor="lfr-percent">Percent of due amount</Label>
              <Input id="lfr-percent" type="number" min={0} max={100} value={draft.percent ?? 0} onChange={(e) => setDraft((d) => ({ ...d, percent: Number(e.target.value) }))} />
            </div>
          ) : draft.calcType !== "slab" ? (
            <div>
              <Label htmlFor="lfr-amount">{draft.calcType === "fixed" ? "Amount (₹)" : `Rate per ${draft.calcType.replace("ly", "")} (₹)`}</Label>
              <Input
                id="lfr-amount"
                type="number"
                min={0}
                value={draft.amount ? draft.amount.minorUnits / 100 : 0}
                onChange={(e) => setDraft((d) => ({ ...d, amount: moneyFromMajor(Number(e.target.value), "INR") }))}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Slab-based rules can be fine-tuned after creation.</p>
          )}
          <div>
            <Label htmlFor="lfr-cap">Maximum cap (₹, optional)</Label>
            <Input
              id="lfr-cap"
              type="number"
              min={0}
              value={draft.maxCapAmount ? draft.maxCapAmount.minorUnits / 100 : ""}
              onChange={(e) => setDraft((d) => ({ ...d, maxCapAmount: e.target.value === "" ? undefined : moneyFromMajor(Number(e.target.value), "INR") }))}
            />
          </div>
          <Button
            disabled={!draft.name.trim()}
            onClick={() => {
              createLateFeeRule(draft, ACTOR);
              setCreateOpen(false);
            }}
          >
            Create rule
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={waiveTarget !== null} onOpenChange={(open) => !open && setWaiveTarget(null)} title="Waive fine" description="Leave the amount blank to waive in full">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="waive-amount">Amount to waive (₹, optional)</Label>
            <Input id="waive-amount" type="number" min={0} value={waiveAmount} onChange={(e) => setWaiveAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="waive-reason">Reason</Label>
            <Input id="waive-reason" value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} placeholder="Required for the audit trail" />
          </div>
          <Button
            disabled={!waiveReason.trim()}
            onClick={() => {
              if (!waiveTarget) return;
              waiveFine(waiveTarget, waiveAmount ? moneyFromMajor(Number(waiveAmount), "INR") : undefined, waiveReason.trim(), ACTOR);
              setWaiveTarget(null);
            }}
          >
            Waive fine
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
