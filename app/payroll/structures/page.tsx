"use client";

import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTeachers } from "@/lib/hooks/use-academics";
import { useSalaryStructures } from "@/lib/hooks/use-finance";
import { formatMoney, moneyFromMajor } from "@/lib/finance/money";
import { resolveSalaryStructure } from "@/lib/selectors/salary-calc";
import { createSalaryStructure, deactivateSalaryStructure, type SalaryComponentDraft } from "@/lib/services/salary-structure-service";
import { salaryComponentCalcTypeLabels, type SalaryComponentCalcType, type SalaryComponentCategory, type SalaryStructure } from "@/lib/types/payroll";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { formatDate, generateId } from "@/lib/utils";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };
const calcTypeOptions = Object.keys(salaryComponentCalcTypeLabels) as SalaryComponentCalcType[];

function blankComponent(): SalaryComponentDraft {
  return { id: generateId("sc"), name: "", category: "earning", calcType: "fixed", amount: moneyFromMajor(0, "INR"), taxable: true, recurring: true };
}

export default function SalaryStructuresPage() {
  const structures = useSalaryStructures();
  const teachers = useTeachers();
  const { can } = usePermissions();
  const canManage = can("payroll.manageStructures");

  const [detail, setDetail] = useState<SalaryStructure | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [components, setComponents] = useState<SalaryComponentDraft[]>([blankComponent()]);

  function employeeName(id: string) {
    return teachers.find((t) => t.id === id)?.name ?? id;
  }

  function updateComponent(index: number, patch: Partial<SalaryComponentDraft>) {
    setComponents((current) => current.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  const columns: ColumnDef<SalaryStructure>[] = [
    {
      id: "name",
      header: "Structure",
      alwaysVisible: true,
      sortValue: (s) => s.name,
      cell: (s) => (
        <button type="button" onClick={() => setDetail(s)} className="text-left">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{s.name}</p>
          <p className="text-xs text-muted-foreground">{employeeName(s.employeeId)}</p>
        </button>
      ),
    },
    { id: "gross", header: "Gross / month", align: "right", sortValue: (s) => resolveSalaryStructure(s).grossPay.minorUnits, cell: (s) => <span className="text-sm font-medium text-foreground">{formatMoney(resolveSalaryStructure(s).grossPay)}</span> },
    { id: "effective", header: "Effective from", cell: (s) => <span className="text-sm text-muted-foreground">{formatDate(s.effectiveFrom)}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (s) => <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status === "active" ? "Active" : "Inactive"}</Badge> },
  ];

  const rowActions: RowAction<SalaryStructure>[] = canManage ? [{ key: "deactivate", label: "Deactivate", icon: <Trash2 className="size-3.5" />, hidden: (s) => s.status !== "active", destructive: true, onSelect: (s) => deactivateSalaryStructure(s.id, ACTOR) }] : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Salary structures</h1>
          <p className="text-xs text-muted-foreground">Earning and deduction components — one active structure per employee</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setEmployeeId("");
              setName("");
              setComponents([blankComponent()]);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            New structure
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...structures].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))}
        getRowId={(s) => s.id}
        caption="Salary structures"
        rowActions={rowActions}
        renderMobileCard={(s) => (
          <button type="button" onClick={() => setDetail(s)} className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
              <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status === "active" ? "Active" : "Inactive"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{employeeName(s.employeeId)}</p>
            <p className="text-sm font-medium text-foreground">{formatMoney(resolveSalaryStructure(s).grossPay)} gross</p>
          </button>
        )}
        emptyIcon={Users}
        emptyTitle="No salary structures yet"
      />

      <DetailDrawer open={!!detail} onOpenChange={(open) => !open && setDetail(null)} title={detail?.name ?? ""} description={detail ? employeeName(detail.employeeId) : undefined}>
        {detail && (
          <div className="flex flex-col gap-sm">
            {(() => {
              const resolved = resolveSalaryStructure(detail);
              return (
                <>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Earnings</p>
                    <div className="flex flex-col gap-1">
                      {resolved.earnings.map((e) => (
                        <div key={e.component.id} className="flex items-center justify-between text-sm">
                          <span className="text-foreground">{e.component.name}</span>
                          <span className="text-foreground">{formatMoney(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Deductions</p>
                    <div className="flex flex-col gap-1">
                      {resolved.deductions.map((d) => (
                        <div key={d.component.id} className="flex items-center justify-between text-sm">
                          <span className="text-foreground">{d.component.name}</span>
                          <span className="text-foreground">{formatMoney(d.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-sm text-sm font-semibold">
                    <span className="text-foreground">Net pay</span>
                    <span className="text-foreground">{formatMoney(resolved.netPay)}</span>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New salary structure" description="Activating this supersedes any existing active structure for the employee">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger aria-label="Employee">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="struct-name">Structure name</Label>
            <Input id="struct-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard structure" />
          </div>

          <div className="flex flex-col gap-xs">
            <Label>Components</Label>
            {components.map((component, i) => (
              <div key={i} className="flex flex-col gap-xs rounded-lg border border-border p-sm">
                <div className="flex items-center gap-xs">
                  <Input value={component.name} onChange={(e) => updateComponent(i, { name: e.target.value })} placeholder="Component name" className="flex-1" />
                  <Button variant="ghost" size="icon" disabled={components.length <= 1} onClick={() => setComponents((current) => current.filter((_, idx) => idx !== i))} aria-label={`Remove component ${i + 1}`}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-xs">
                  <Select value={component.category} onValueChange={(v) => updateComponent(i, { category: v as SalaryComponentCategory })}>
                    <SelectTrigger aria-label={`Component ${i + 1} category`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="earning">Earning</SelectItem>
                      <SelectItem value="deduction">Deduction</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={component.calcType} onValueChange={(v) => updateComponent(i, { calcType: v as SalaryComponentCalcType })}>
                    <SelectTrigger aria-label={`Component ${i + 1} calc type`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {calcTypeOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {salaryComponentCalcTypeLabels[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {component.calcType === "percentage" ? (
                  <div className="grid grid-cols-2 gap-xs">
                    <Input type="number" min={0} max={100} value={component.percent ?? 0} onChange={(e) => updateComponent(i, { percent: Number(e.target.value) })} placeholder="Percent" />
                    <Select value={component.percentOfComponentId ?? ""} onValueChange={(v) => updateComponent(i, { percentOfComponentId: v })}>
                      <SelectTrigger aria-label={`Component ${i + 1} base`}>
                        <SelectValue placeholder="% of…" />
                      </SelectTrigger>
                      <SelectContent>
                        {components
                          .filter((c) => c.id !== component.id)
                          .map((c, idx) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name || `Component ${idx + 1}`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <Input type="number" min={0} value={(component.amount?.minorUnits ?? 0) / 100} onChange={(e) => updateComponent(i, { amount: moneyFromMajor(Number(e.target.value), "INR") })} placeholder="Amount ₹" />
                )}
                <div className="flex items-center gap-md">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox checked={component.taxable} onCheckedChange={(v) => updateComponent(i, { taxable: v === true })} />
                    Taxable
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox checked={component.recurring} onCheckedChange={(v) => updateComponent(i, { recurring: v === true })} />
                    Recurring
                  </label>
                </div>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setComponents((current) => [...current, blankComponent()])}>
              <Plus className="size-3.5" />
              Add component
            </Button>
          </div>

          <Button
            disabled={!employeeId || !name.trim() || components.some((c) => !c.name.trim())}
            onClick={() => {
              createSalaryStructure(
                {
                  name: name.trim(),
                  employeeId,
                  session: CURRENT_SESSION,
                  currency: "INR",
                  effectiveFrom: new Date().toISOString().slice(0, 10),
                  components,
                },
                ACTOR,
              );
              setCreateOpen(false);
            }}
          >
            Create structure
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
