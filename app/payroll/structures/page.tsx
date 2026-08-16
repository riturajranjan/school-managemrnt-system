"use client";

// Real PostgreSQL/API cutover (Phase 9H). Three real, separate concepts on
// one page (matches the mock's single nav entry): a reusable Salary
// Component catalogue, reusable Salary Structures built from that catalogue
// (structural edits lock once ANY staff is assigned — mirrors Phase 9F's
// FeeStructure), and effective-dated Staff <-> Structure assignments. The
// mock's "one inline structure per employee" model is replaced by this
// correct reusable-structure + assignment split (see the schema doc
// comment) — an intentional architecture correction, not a redesign of the
// visual language.
import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStaff } from "@/lib/hooks/api/use-staff";
import {
  createSalaryComponentRequest,
  createSalaryStructureRequest,
  createStaffSalaryAssignmentRequest,
  setSalaryStructureStatusRequest,
  updateSalaryComponentRequest,
  useSalaryComponents,
  useSalaryStructure,
  useSalaryStructures,
  useStaffSalaryAssignments,
} from "@/lib/hooks/api/use-payroll-api";
import type { CreateSalaryStructureComponentInput, SalaryComponentDto, SalaryComponentTypeDto, SalaryStructureListItemDto, StaffSalaryAssignmentDto } from "@/lib/api/contracts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Tab = "components" | "structures" | "assignments";
const tabs: { key: Tab; label: string }[] = [
  { key: "components", label: "Components" },
  { key: "structures", label: "Structures" },
  { key: "assignments", label: "Staff assignments" },
];

export default function SalaryStructuresPage() {
  const { can } = usePermissions();
  const canManage = can("payroll.manage");
  const [tab, setTab] = useState<Tab>("structures");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Salary structures</h1>
        <p className="text-xs text-muted-foreground">Components, reusable structures, and staff assignments</p>
      </div>

      <div className="flex items-center gap-1 rounded-md bg-surface-secondary p-1">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn("min-h-8 flex-1 rounded-md px-sm text-xs font-medium transition-colors", tab === t.key ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "components" && <ComponentsTab canManage={canManage} />}
      {tab === "structures" && <StructuresTab canManage={canManage} />}
      {tab === "assignments" && <AssignmentsTab canManage={canManage} />}
    </div>
  );
}

function ComponentsTab({ canManage }: { canManage: boolean }) {
  const { data: components, reload } = useSalaryComponents();
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<SalaryComponentTypeDto>("earning");
  const [calcType, setCalcType] = useState<"fixed" | "percentage">("fixed");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const columns: ColumnDef<SalaryComponentDto>[] = [
    { id: "code", header: "Code", cell: (c) => <span className="text-sm font-mono text-muted-foreground">{c.code}</span> },
    { id: "name", header: "Name", alwaysVisible: true, sortValue: (c) => c.name, cell: (c) => <span className="text-sm font-medium text-foreground">{c.name}</span> },
    { id: "type", header: "Type", cell: (c) => <Badge tone={c.type === "earning" ? "success" : "neutral"}>{c.type === "earning" ? "Earning" : "Deduction"}</Badge> },
    { id: "calcType", header: "Calc", cell: (c) => <span className="text-sm text-muted-foreground">{c.calcType === "fixed" ? "Fixed" : "Percentage"}</span> },
    { id: "status", header: "Status", align: "right", cell: (c) => <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status === "active" ? "Active" : "Archived"}</Badge> },
  ];
  const rowActions: RowAction<SalaryComponentDto>[] = canManage
    ? [
        { key: "archive", label: "Archive", icon: <Trash2 className="size-3.5" />, hidden: (c) => c.status !== "active", destructive: true, onSelect: async (c) => { await updateSalaryComponentRequest(c.id, { status: "archived" }); reload(); } },
        { key: "reactivate", label: "Reactivate", hidden: (c) => c.status !== "archived", onSelect: async (c) => { await updateSalaryComponentRequest(c.id, { status: "active" }); reload(); } },
      ]
    : [];

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center justify-end">
        {canManage && (
          <Button size="sm" onClick={() => { setCode(""); setName(""); setType("earning"); setErr(null); setCreateOpen(true); }}>
            <Plus className="size-3.5" />
            New component
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={components}
        getRowId={(c) => c.id}
        caption="Salary components"
        rowActions={rowActions}
        renderMobileCard={(c) => (
          <div className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.code} · {c.type === "earning" ? "Earning" : "Deduction"}</p>
            </div>
            <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status === "active" ? "Active" : "Archived"}</Badge>
          </div>
        )}
        emptyIcon={Users}
        emptyTitle="No salary components yet"
      />
      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New salary component" description="A reusable earning or deduction line usable in any structure">
        <div className="flex flex-col gap-sm">
          {err && <p className="text-xs text-error">{err}</p>}
          <div>
            <Label htmlFor="comp-code">Code</Label>
            <Input id="comp-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. BASIC" />
          </div>
          <div>
            <Label htmlFor="comp-name">Name</Label>
            <Input id="comp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basic Pay" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as SalaryComponentTypeDto)}>
              <SelectTrigger aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="earning">Earning</SelectItem>
                <SelectItem value="deduction">Deduction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Calculation</Label>
            <Select value={calcType} onValueChange={(v) => setCalcType(v as "fixed" | "percentage")}>
              <SelectTrigger aria-label="Calculation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed amount</SelectItem>
                <SelectItem value="percentage">Percentage of another fixed component</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={busy || !code.trim() || !name.trim()}
            onClick={async () => {
              setBusy(true); setErr(null);
              const res = await createSalaryComponentRequest({ code: code.trim(), name: name.trim(), type, calcType });
              setBusy(false);
              if (!res.success) { setErr(res.error.message); return; }
              setCreateOpen(false);
              reload();
            }}
          >
            Create component
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}

function blankLine(): CreateSalaryStructureComponentInput & { key: string } {
  return { key: Math.random().toString(36).slice(2), componentId: "" };
}

function StructuresTab({ canManage }: { canManage: boolean }) {
  const { data: structures, reload } = useSalaryStructures();
  const { data: components } = useSalaryComponents({ status: "active" });
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: detail } = useSalaryStructure(detailId);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [lines, setLines] = useState<(CreateSalaryStructureComponentInput & { key: string })[]>([blankLine()]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fixedComponentIds = new Set(lines.filter((l) => l.componentId && components?.find((c) => c.id === l.componentId)?.calcType === "fixed").map((l) => l.componentId));

  function updateLine(key: string, patch: Partial<CreateSalaryStructureComponentInput>) {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const columns: ColumnDef<SalaryStructureListItemDto>[] = [
    {
      id: "name", header: "Structure", alwaysVisible: true, sortValue: (s) => s.name,
      cell: (s) => (
        <button type="button" onClick={() => setDetailId(s.id)} className="text-left">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{s.name}</p>
          <p className="text-xs text-muted-foreground">{s.componentCount} component(s)</p>
        </button>
      ),
    },
    { id: "assignments", header: "Assigned staff", align: "right", cell: (s) => <span className="text-sm text-muted-foreground">{s.assignmentCount}</span> },
    { id: "status", header: "Status", align: "right", cell: (s) => <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status === "active" ? "Active" : "Archived"}</Badge> },
  ];
  const rowActions: RowAction<SalaryStructureListItemDto>[] = canManage
    ? [
        { key: "archive", label: "Archive", icon: <Trash2 className="size-3.5" />, hidden: (s) => s.status !== "active", destructive: true, onSelect: async (s) => { await setSalaryStructureStatusRequest(s.id, { status: "archived" }); reload(); } },
        { key: "reactivate", label: "Reactivate", hidden: (s) => s.status !== "archived", onSelect: async (s) => { await setSalaryStructureStatusRequest(s.id, { status: "active" }); reload(); } },
      ]
    : [];

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center justify-end">
        {canManage && (
          <Button size="sm" onClick={() => { setName(""); setLines([blankLine()]); setErr(null); setCreateOpen(true); }}>
            <Plus className="size-3.5" />
            New structure
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={structures}
        getRowId={(s) => s.id}
        caption="Salary structures"
        rowActions={rowActions}
        renderMobileCard={(s) => (
          <button type="button" onClick={() => setDetailId(s.id)} className="surface-3d flex w-full items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-left">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.componentCount} component(s) · {s.assignmentCount} assigned</p>
            </div>
            <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status === "active" ? "Active" : "Archived"}</Badge>
          </button>
        )}
        emptyIcon={Users}
        emptyTitle="No salary structures yet"
      />

      <DetailDrawer open={Boolean(detailId)} onOpenChange={(o) => !o && setDetailId(null)} title={detail?.name ?? ""} description={detail?.description ?? undefined}>
        {detail && (
          <div className="flex flex-col gap-xs">
            {detail.components.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-border p-sm text-sm">
                <div>
                  <p className="font-medium text-foreground">{c.componentName}</p>
                  <p className="text-xs text-muted-foreground">{c.type === "earning" ? "Earning" : "Deduction"}</p>
                </div>
                <span className="text-foreground">{c.calcType === "fixed" ? formatCurrency(c.amount ?? 0) : `${c.percent}%`}</span>
              </div>
            ))}
            {detail.assignmentCount > 0 && <p className="text-xs text-muted-foreground">Structurally locked — {detail.assignmentCount} staff assignment(s) reference this structure.</p>}
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New salary structure" description="Pick components from the catalogue">
        <div className="flex flex-col gap-sm">
          {err && <p className="text-xs text-error">{err}</p>}
          <div>
            <Label htmlFor="struct-name">Structure name</Label>
            <Input id="struct-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard structure" />
          </div>

          <div className="flex flex-col gap-xs">
            <Label>Components</Label>
            {lines.map((line) => {
              const comp = components?.find((c) => c.id === line.componentId);
              return (
                <div key={line.key} className="flex flex-col gap-xs rounded-lg border border-border p-sm">
                  <div className="flex items-center gap-xs">
                    <div className="flex-1">
                      <Select value={line.componentId} onValueChange={(v) => updateLine(line.key, { componentId: v, amount: undefined, percent: undefined, percentOfComponentId: undefined })}>
                        <SelectTrigger aria-label="Component">
                          <SelectValue placeholder="Select component" />
                        </SelectTrigger>
                        <SelectContent>
                          {components?.filter((c) => !lines.some((l) => l.key !== line.key && l.componentId === c.id)).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.type === "earning" ? "Earning" : "Deduction"})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" disabled={lines.length <= 1} onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))} aria-label="Remove component">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  {comp?.calcType === "percentage" ? (
                    <div className="grid grid-cols-2 gap-xs">
                      <Input type="number" min={0} max={100} value={line.percent ?? ""} onChange={(e) => updateLine(line.key, { percent: Number(e.target.value) })} placeholder="Percent" />
                      <Select value={line.percentOfComponentId ?? ""} onValueChange={(v) => updateLine(line.key, { percentOfComponentId: v })}>
                        <SelectTrigger aria-label="Percentage base">
                          <SelectValue placeholder="% of…" />
                        </SelectTrigger>
                        <SelectContent>
                          {lines.filter((l) => l.key !== line.key && fixedComponentIds.has(l.componentId)).map((l) => (
                            <SelectItem key={l.componentId} value={l.componentId}>{components?.find((c) => c.id === l.componentId)?.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : comp?.calcType === "fixed" ? (
                    <Input type="number" min={0} value={line.amount ?? ""} onChange={(e) => updateLine(line.key, { amount: Number(e.target.value) })} placeholder="Amount ₹" />
                  ) : null}
                </div>
              );
            })}
            <Button variant="secondary" size="sm" onClick={() => setLines((current) => [...current, blankLine()])}>
              <Plus className="size-3.5" />
              Add component
            </Button>
          </div>

          <Button
            disabled={busy || !name.trim() || lines.some((l) => !l.componentId)}
            onClick={async () => {
              setBusy(true); setErr(null);
              const res = await createSalaryStructureRequest({ name: name.trim(), components: lines.map(({ key: _key, ...rest }) => rest) });
              setBusy(false);
              if (!res.success) { setErr(res.error.message); return; }
              setCreateOpen(false);
              reload();
            }}
          >
            Create structure
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}

function AssignmentsTab({ canManage }: { canManage: boolean }) {
  const { data: assignments, reload } = useStaffSalaryAssignments();
  const { data: staff } = useStaff({ status: "active" });
  const { data: structures } = useSalaryStructures({ status: "active" });
  const [createOpen, setCreateOpen] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [structureId, setStructureId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const columns: ColumnDef<StaffSalaryAssignmentDto>[] = [
    { id: "staff", header: "Staff", alwaysVisible: true, sortValue: (a) => a.staffName, cell: (a) => <div><p className="text-sm font-medium text-foreground">{a.staffName}</p><p className="text-xs text-muted-foreground">{a.employeeCode}</p></div> },
    { id: "structure", header: "Structure", cell: (a) => <span className="text-sm text-foreground">{a.salaryStructureName}</span> },
    { id: "from", header: "Effective from", cell: (a) => <span className="text-sm text-muted-foreground">{formatDate(a.effectiveFrom)}</span> },
    { id: "to", header: "Effective to", cell: (a) => <span className="text-sm text-muted-foreground">{a.effectiveTo ? formatDate(a.effectiveTo) : "Ongoing"}</span> },
  ];

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center justify-end">
        {canManage && (
          <Button size="sm" onClick={() => { setStaffId(""); setStructureId(""); setEffectiveFrom(new Date().toISOString().slice(0, 10)); setErr(null); setCreateOpen(true); }}>
            <Plus className="size-3.5" />
            New assignment
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={assignments}
        getRowId={(a) => a.id}
        caption="Staff salary assignments"
        renderMobileCard={(a) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <p className="text-sm font-semibold text-foreground">{a.staffName}</p>
            <p className="text-xs text-muted-foreground">{a.salaryStructureName} · from {formatDate(a.effectiveFrom)}</p>
          </div>
        )}
        emptyIcon={Users}
        emptyTitle="No staff have a salary structure assigned yet"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New salary assignment" description="A salary change is always a new effective-dated assignment, never an edit to history">
        <div className="flex flex-col gap-sm">
          {err && <p className="text-xs text-error">{err}</p>}
          <div>
            <Label>Staff</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger aria-label="Staff">
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                {staff?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.employeeCode})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Salary structure</Label>
            <Select value={structureId} onValueChange={setStructureId}>
              <SelectTrigger aria-label="Salary structure">
                <SelectValue placeholder="Select structure" />
              </SelectTrigger>
              <SelectContent>
                {structures?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="eff-from">Effective from</Label>
            <Input id="eff-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <Button
            disabled={busy || !staffId || !structureId}
            onClick={async () => {
              setBusy(true); setErr(null);
              const res = await createStaffSalaryAssignmentRequest({ staffId, salaryStructureId: structureId, effectiveFrom });
              setBusy(false);
              if (!res.success) { setErr(res.error.message); return; }
              setCreateOpen(false);
              reload();
            }}
          >
            Assign
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
