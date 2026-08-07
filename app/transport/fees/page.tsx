"use client";

import { useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportFeeCharges, useTransportFeeRules, useTransportRoutes } from "@/lib/hooks/use-transport";
import { useStudents } from "@/lib/hooks/use-students";
import { formatMoney, moneyFromMajor } from "@/lib/finance/money";
import { useSisStore } from "@/lib/hooks/use-store";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { transportFeeInsights } from "@/lib/selectors/transport-fee-insights";
import { createTransportFeeRule, generateChargesForPeriod, recordChargePayment } from "@/lib/services/transport-fee-service";
import { transportFeeBasisLabels, transportFeeChargeStatusLabels, transportFeeFrequencyLabels, type TransportFeeBasis, type TransportFeeCharge, type TransportFeeChargeStatus, type TransportFeeFrequency, type TransportFeeRule } from "@/lib/types/transport";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Accountant", role: "Accountant" };
const basisOptions = Object.keys(transportFeeBasisLabels) as TransportFeeBasis[];
const frequencyOptions = Object.keys(transportFeeFrequencyLabels) as TransportFeeFrequency[];

const chargeStatusTone: Record<TransportFeeChargeStatus, "success" | "warning" | "error" | "neutral"> = {
  pending: "warning",
  partial: "warning",
  paid: "success",
  waived: "neutral",
  cancelled: "neutral",
};

export default function TransportFeesPage() {
  const db = useSisStore();
  const routes = useTransportRoutes();
  const rules = useTransportFeeRules();
  const charges = useTransportFeeCharges();
  const students = useStudents();
  const { can } = usePermissions();
  const canManage = can("transport.manageFees");

  const insights = transportFeeInsights(db, CURRENT_SESSION);

  const [ruleOpen, setRuleOpen] = useState(false);
  const [name, setName] = useState("");
  const [basis, setBasis] = useState<TransportFeeBasis>("route");
  const [routeId, setRouteId] = useState("");
  const [amount, setAmount] = useState(2000);
  const [frequency, setFrequency] = useState<TransportFeeFrequency>("monthly");
  const [siblingDiscount, setSiblingDiscount] = useState(0);

  const [payTarget, setPayTarget] = useState<TransportFeeCharge | null>(null);
  const [payAmount, setPayAmount] = useState(0);

  function routeName(id?: string) {
    return routes.find((r) => r.id === id)?.name ?? "—";
  }
  function subjectName(charge: TransportFeeCharge) {
    if (charge.subjectType === "student") {
      const student = students.find((s) => s.id === charge.studentId);
      return student ? `${student.profile.firstName} ${student.profile.lastName}` : (charge.studentId ?? "—");
    }
    return db.staffTransportAssignments.find((a) => a.id === charge.assignmentId)?.staffName ?? charge.staffId ?? "—";
  }

  const ruleColumns: ColumnDef<TransportFeeRule>[] = [
    { id: "name", header: "Rule", alwaysVisible: true, cell: (r) => <span className="text-sm font-medium text-foreground">{r.name}</span> },
    { id: "basis", header: "Basis", cell: (r) => <span className="text-sm text-muted-foreground">{transportFeeBasisLabels[r.basis]}{r.basis === "route" ? ` · ${routeName(r.routeId)}` : ""}</span> },
    { id: "amount", header: "Amount", align: "right", cell: (r) => <span className="text-sm text-foreground">{formatMoney(r.amount)} / {transportFeeFrequencyLabels[r.frequency].toLowerCase()}</span> },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</Badge> },
  ];

  const chargeColumns: ColumnDef<TransportFeeCharge>[] = [
    { id: "subject", header: "Rider", alwaysVisible: true, sortValue: subjectName, cell: (c) => <span className="text-sm font-medium text-foreground">{subjectName(c)}</span> },
    { id: "period", header: "Period", cell: (c) => <span className="text-sm text-muted-foreground">{c.period}</span> },
    { id: "billed", header: "Billed", align: "right", cell: (c) => <span className="text-sm text-foreground">{formatMoney(c.billedAmount)}</span> },
    { id: "paid", header: "Paid", align: "right", cell: (c) => <span className="text-sm text-muted-foreground">{formatMoney(c.paidAmount)}</span> },
    { id: "due", header: "Due", cell: (c) => <span className="text-sm text-muted-foreground">{formatDate(c.dueDate)}</span> },
    { id: "status", header: "Status", align: "right", cell: (c) => <Badge tone={chargeStatusTone[c.status]}>{transportFeeChargeStatusLabels[c.status]}</Badge> },
  ];

  const chargeActions: RowAction<TransportFeeCharge>[] = canManage
    ? [
        {
          key: "pay",
          label: "Record payment",
          hidden: (c) => c.status === "paid" || c.status === "waived" || c.status === "cancelled",
          onSelect: (c) => {
            setPayTarget(c);
            setPayAmount(0);
          },
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Transport fees</h1>
          <p className="text-xs text-muted-foreground">Route-based fee rules and collection</p>
        </div>
        {canManage && (
          <div className="flex gap-xs">
            <Button size="sm" variant="secondary" onClick={() => generateChargesForPeriod(CURRENT_SESSION, new Date().toISOString().slice(0, 7), ACTOR)}>
              Generate this month&apos;s charges
            </Button>
            <Button size="sm" onClick={() => setRuleOpen(true)}>
              <Plus className="size-3.5" />
              New fee rule
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Expected this session" value={formatMoney(insights.totalExpected, { compact: true })} tone="neutral" />
        <StatTile label="Collected" value={formatMoney(insights.totalCollected, { compact: true })} tone="success" />
        <StatTile label="Pending" value={formatMoney(insights.totalPending, { compact: true })} tone={insights.totalPending.minorUnits > 0 ? "warning" : "success"} />
        <StatTile label="Overdue charges" value={String(insights.overdue.length)} tone={insights.overdue.length > 0 ? "error" : "success"} />
      </div>

      {insights.unbilledStudentAssignments.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/8 p-sm text-sm text-warning">
          {insights.unbilledStudentAssignments.length} active student assignment(s) have no matching fee rule and can&apos;t be billed yet.
        </div>
      )}

      <Tabs defaultValue="charges">
        <TabsList>
          <TabsTrigger value="charges">Charges</TabsTrigger>
          <TabsTrigger value="rules">Fee rules</TabsTrigger>
        </TabsList>
        <TabsContent value="charges" className="mt-sm">
          <DataTable
            columns={chargeColumns}
            rows={[...charges].sort((a, b) => (a.period < b.period ? 1 : -1))}
            getRowId={(c) => c.id}
            caption="Transport fee charges"
            rowActions={chargeActions}
            renderMobileCard={(c) => (
              <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{subjectName(c)}</p>
                  <Badge tone={chargeStatusTone[c.status]}>{transportFeeChargeStatusLabels[c.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.period} · {formatMoney(c.billedAmount)}
                </p>
              </div>
            )}
            emptyIcon={Wallet}
            emptyTitle="No charges generated yet"
          />
        </TabsContent>
        <TabsContent value="rules" className="mt-sm">
          <DataTable
            columns={ruleColumns}
            rows={rules}
            getRowId={(r) => r.id}
            caption="Transport fee rules"
            renderMobileCard={(r) => (
              <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                  <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{formatMoney(r.amount)} / {transportFeeFrequencyLabels[r.frequency].toLowerCase()}</p>
              </div>
            )}
            emptyIcon={Wallet}
            emptyTitle="No fee rules configured"
          />
        </TabsContent>
      </Tabs>

      <DetailDrawer open={ruleOpen} onOpenChange={setRuleOpen} title="New fee rule" description="Applies to future assignments and charge generation">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="rule-name">Name</Label>
            <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Basis</Label>
            <Select value={basis} onValueChange={(v) => setBasis(v as TransportFeeBasis)}>
              <SelectTrigger aria-label="Basis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {basisOptions.map((b) => (
                  <SelectItem key={b} value={b}>
                    {transportFeeBasisLabels[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {basis === "route" && (
            <div>
              <Label>Route</Label>
              <Select value={routeId} onValueChange={setRouteId}>
                <SelectTrigger aria-label="Route">
                  <SelectValue placeholder="Select route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="rule-amount">Amount (₹)</Label>
            <Input id="rule-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as TransportFeeFrequency)}>
              <SelectTrigger aria-label="Frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {frequencyOptions.map((f) => (
                  <SelectItem key={f} value={f}>
                    {transportFeeFrequencyLabels[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rule-sibling">Sibling discount (%)</Label>
            <Input id="rule-sibling" type="number" min={0} max={100} value={siblingDiscount} onChange={(e) => setSiblingDiscount(Number(e.target.value))} />
          </div>
          <Button
            disabled={!name.trim() || (basis === "route" && !routeId)}
            onClick={() => {
              createTransportFeeRule({ name: name.trim(), basis, routeId: basis === "route" ? routeId : undefined, amount: moneyFromMajor(amount, "INR"), frequency, session: CURRENT_SESSION, siblingDiscountPercent: siblingDiscount || undefined }, ACTOR);
              setRuleOpen(false);
              setName("");
              setRouteId("");
            }}
          >
            Create rule
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={!!payTarget} onOpenChange={(open) => !open && setPayTarget(null)} title="Record payment" description={payTarget ? subjectName(payTarget) : undefined}>
        <div className="flex flex-col gap-sm">
          {payTarget && (
            <p className="text-xs text-muted-foreground">
              Billed {formatMoney(payTarget.billedAmount)} · Paid so far {formatMoney(payTarget.paidAmount)}
            </p>
          )}
          <div>
            <Label htmlFor="pay-amount">Amount (₹)</Label>
            <Input id="pay-amount" type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
          </div>
          <Button
            disabled={payAmount <= 0}
            onClick={() => {
              if (payTarget) recordChargePayment(payTarget.id, moneyFromMajor(payAmount, "INR"), ACTOR);
              setPayTarget(null);
            }}
          >
            Record payment
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
