"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { formatMoney, moneyFromMajor, splitEvenly, sumMoney, toMajorUnits, zeroMoney } from "@/lib/finance/money";
import { createFeeStructure, type FeeStructureDraft } from "@/lib/services/fee-structure-service";
import {
  admissionTypeFilterLabels,
  feeComponentTypeLabels,
  feeFrequencyLabels,
  prorationRuleLabels,
  type AdmissionTypeFilter,
  type FeeComponent,
  type FeeComponentType,
  type FeeFrequency,
  type FeeInstallment,
  type ProrationRule,
} from "@/lib/types/fees";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };
const componentTypeOptions = Object.keys(feeComponentTypeLabels) as FeeComponentType[];
const frequencyOptions = Object.keys(feeFrequencyLabels) as FeeFrequency[];
const admissionTypeOptions = Object.keys(admissionTypeFilterLabels) as AdmissionTypeFilter[];
const prorationOptions = Object.keys(prorationRuleLabels) as ProrationRule[];

let componentCounter = 0;
let installmentCounter = 0;
function nextComponentId() {
  componentCounter += 1;
  return `draft-fc-${componentCounter}`;
}
function nextInstallmentId() {
  installmentCounter += 1;
  return `draft-fi-${installmentCounter}`;
}

function blankComponent(): FeeComponent {
  return { id: nextComponentId(), type: "tuition", label: "Tuition fee", amount: zeroMoney("INR"), taxable: false, refundable: false, optional: false };
}

function blankInstallment(): FeeInstallment {
  return { id: nextInstallmentId(), label: "Installment", dueDate: "", amount: zeroMoney("INR"), componentIds: [] };
}

export default function NewFeeStructurePage() {
  const router = useRouter();
  const classes = useManagedClasses();

  const [name, setName] = useState("");
  const [session, setSession] = useState(CURRENT_SESSION);
  const [applicableClassIds, setApplicableClassIds] = useState<string[]>([]);
  const [admissionType, setAdmissionType] = useState<AdmissionTypeFilter>("all");
  const [frequency, setFrequency] = useState<FeeFrequency>("quarterly");
  const [gracePeriodDays, setGracePeriodDays] = useState(10);
  const [prorationRule, setProrationRule] = useState<ProrationRule>("none");
  const [discountCompatible, setDiscountCompatible] = useState(true);
  const [components, setComponents] = useState<FeeComponent[]>([blankComponent()]);
  const [installments, setInstallments] = useState<FeeInstallment[]>([blankInstallment()]);
  const [errors, setErrors] = useState<string[]>([]);

  const total = sumMoney(
    components.filter((c) => !c.optional).map((c) => c.amount),
    "INR",
  );

  function updateComponent(id: string, patch: Partial<FeeComponent>) {
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function updateInstallment(id: string, patch: Partial<FeeInstallment>) {
    setInstallments((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function distributeEvenly() {
    const shares = splitEvenly(total, installments.length || 1);
    setInstallments((prev) => prev.map((inst, i) => ({ ...inst, amount: shares[i] ?? zeroMoney("INR") })));
  }

  function handleSubmit() {
    const draft: FeeStructureDraft = {
      name: name.trim(),
      session: session.trim(),
      branch: "main",
      applicableClassIds,
      applicableSectionIds: [],
      admissionType,
      components,
      frequency,
      installments,
      gracePeriodDays,
      discountCompatible,
      prorationRule,
      currency: "INR",
      createdBy: ACTOR.name,
      status: "draft",
    };
    const result = createFeeStructure(draft, ACTOR);
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    router.push(`/fees/structures/${result.structure.id}`);
  }

  return (
    <div className="flex flex-col gap-md pb-28 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">New fee structure</h1>
        <p className="text-xs text-muted-foreground">Define components and installments — saved as a draft until you activate it</p>
      </div>

      {errors.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-error/30 bg-error/8 p-sm text-xs text-error">
          <p className="flex items-center gap-1 font-medium">
            <AlertTriangle className="size-3.5" /> Fix these before saving
          </p>
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Summary</h2>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div>
            <Label htmlFor="structure-name">Structure name</Label>
            <Input id="structure-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Class 8 — Standard" />
          </div>
          <div>
            <Label htmlFor="structure-session">Academic session</Label>
            <Input id="structure-session" value={session} onChange={(e) => setSession(e.target.value)} />
          </div>
          <div>
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as FeeFrequency)}>
              <SelectTrigger aria-label="Frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {frequencyOptions.map((f) => (
                  <SelectItem key={f} value={f}>
                    {feeFrequencyLabels[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Admission type</Label>
            <Select value={admissionType} onValueChange={(v) => setAdmissionType(v as AdmissionTypeFilter)}>
              <SelectTrigger aria-label="Admission type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {admissionTypeOptions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {admissionTypeFilterLabels[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="grace-period">Grace period (days)</Label>
            <Input id="grace-period" type="number" min={0} value={gracePeriodDays} onChange={(e) => setGracePeriodDays(Number(e.target.value))} />
          </div>
          <div>
            <Label>Proration rule</Label>
            <Select value={prorationRule} onValueChange={(v) => setProrationRule(v as ProrationRule)}>
              <SelectTrigger aria-label="Proration rule">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {prorationOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {prorationRuleLabels[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-sm">
          <Label>Applicable classes</Label>
          <p className="mb-xs text-xs text-muted-foreground">Leave all unchecked to apply to every class.</p>
          <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-border p-sm sm:grid-cols-3">
            {classes.map((c) => (
              <label key={c.id} className="flex min-h-9 items-center gap-1.5 text-sm text-foreground">
                <Checkbox
                  checked={applicableClassIds.includes(c.id)}
                  onCheckedChange={(checked) => setApplicableClassIds((prev) => (checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))}
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>

        <label className="mt-sm flex items-center justify-between rounded-md border border-border p-sm">
          <span className="text-sm text-foreground">Compatible with discounts &amp; scholarships</span>
          <Switch checked={discountCompatible} onCheckedChange={setDiscountCompatible} />
        </label>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Components</h2>
          <Badge tone="info">Total {formatMoney(total)}</Badge>
        </div>
        <div className="flex flex-col gap-sm">
          {components.map((component, index) => (
            <div key={component.id} className="flex flex-col gap-xs rounded-md border border-border p-sm">
              <div className="grid grid-cols-1 gap-xs sm:grid-cols-2">
                <div>
                  <Label htmlFor={`comp-type-${component.id}`} className="text-[11px]">
                    Type
                  </Label>
                  <Select value={component.type} onValueChange={(v) => updateComponent(component.id, { type: v as FeeComponentType })}>
                    <SelectTrigger id={`comp-type-${component.id}`} aria-label={`Component ${index + 1} type`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {componentTypeOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {feeComponentTypeLabels[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`comp-label-${component.id}`} className="text-[11px]">
                    Label
                  </Label>
                  <Input id={`comp-label-${component.id}`} value={component.label} onChange={(e) => updateComponent(component.id, { label: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-xs sm:grid-cols-4">
                <div>
                  <Label htmlFor={`comp-amount-${component.id}`} className="text-[11px]">
                    Amount (₹)
                  </Label>
                  <Input
                    id={`comp-amount-${component.id}`}
                    type="number"
                    min={0}
                    value={toMajorUnits(component.amount)}
                    onChange={(e) => updateComponent(component.id, { amount: moneyFromMajor(Number(e.target.value) || 0, "INR") })}
                  />
                </div>
                <label className="flex min-h-9 items-center gap-1.5 self-end text-xs text-foreground">
                  <Checkbox checked={component.optional} onCheckedChange={(checked) => updateComponent(component.id, { optional: checked === true })} />
                  Optional
                </label>
                <label className="flex min-h-9 items-center gap-1.5 self-end text-xs text-foreground">
                  <Checkbox checked={component.refundable} onCheckedChange={(checked) => updateComponent(component.id, { refundable: checked === true })} />
                  Refundable
                </label>
                <label className="flex min-h-9 items-center gap-1.5 self-end text-xs text-foreground">
                  <Checkbox checked={component.taxable} onCheckedChange={(checked) => updateComponent(component.id, { taxable: checked === true, taxPercent: checked === true ? component.taxPercent : undefined })} />
                  Taxable
                </label>
              </div>
              {component.taxable && (
                <div className="w-32">
                  <Label htmlFor={`comp-tax-${component.id}`} className="text-[11px]">
                    Tax %
                  </Label>
                  <Input id={`comp-tax-${component.id}`} type="number" min={0} max={100} value={component.taxPercent ?? 0} onChange={(e) => updateComponent(component.id, { taxPercent: Number(e.target.value) })} />
                </div>
              )}
              <Button type="button" size="sm" variant="ghost" className="self-start text-error" onClick={() => setComponents((prev) => prev.filter((c) => c.id !== component.id))}>
                <Trash2 className="size-3.5" />
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setComponents((prev) => [...prev, blankComponent()])}>
            <Plus className="size-3.5" />
            Add component
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Installments</h2>
          <Button type="button" size="sm" variant="outline" onClick={distributeEvenly}>
            <Sparkles className="size-3.5" />
            Distribute evenly
          </Button>
        </div>
        <div className="flex flex-col gap-sm">
          {installments.map((installment, index) => (
            <div key={installment.id} className="grid grid-cols-1 gap-xs rounded-md border border-border p-sm sm:grid-cols-4">
              <div>
                <Label htmlFor={`inst-label-${installment.id}`} className="text-[11px]">
                  Label
                </Label>
                <Input id={`inst-label-${installment.id}`} value={installment.label} onChange={(e) => updateInstallment(installment.id, { label: e.target.value })} placeholder={`Installment ${index + 1}`} />
              </div>
              <div>
                <Label htmlFor={`inst-date-${installment.id}`} className="text-[11px]">
                  Due date
                </Label>
                <Input id={`inst-date-${installment.id}`} type="date" value={installment.dueDate} onChange={(e) => updateInstallment(installment.id, { dueDate: e.target.value })} />
              </div>
              <div>
                <Label htmlFor={`inst-amount-${installment.id}`} className="text-[11px]">
                  Amount (₹)
                </Label>
                <Input
                  id={`inst-amount-${installment.id}`}
                  type="number"
                  min={0}
                  value={toMajorUnits(installment.amount)}
                  onChange={(e) => updateInstallment(installment.id, { amount: moneyFromMajor(Number(e.target.value) || 0, "INR") })}
                />
              </div>
              <Button type="button" size="sm" variant="ghost" className="self-end text-error" onClick={() => setInstallments((prev) => prev.filter((i) => i.id !== installment.id))}>
                <Trash2 className="size-3.5" />
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setInstallments((prev) => [...prev, blankInstallment()])}>
            <Plus className="size-3.5" />
            Add installment
          </Button>
        </div>
      </div>

      <div className="sticky bottom-16 left-0 right-0 flex justify-end gap-sm rounded-lg border border-border bg-surface p-sm shadow-floating sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <Button variant="outline" onClick={() => router.push("/fees/structures")}>
          Cancel
        </Button>
        <Button disabled={!name.trim()} onClick={handleSubmit}>
          Save structure
        </Button>
      </div>
    </div>
  );
}
