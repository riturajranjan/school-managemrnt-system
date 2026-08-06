"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Gift, MoreHorizontal, Plus, Printer, ReceiptText, Wallet, X } from "lucide-react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { TimelineList } from "@/components/timeline/timeline-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useCreditBalances, useDiscounts, useFeeStructures, usePayments, useReceipts, useScholarships } from "@/lib/hooks/use-finance";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, sumMoney } from "@/lib/finance/money";
import { netDueForItem, totalOutstanding, totalOverdue } from "@/lib/selectors/fee-item-insights";
import { addAdHocFeeItem, addManualCredit, applyConcessionToStudent, applyDiscountToStudent, applyScholarshipToStudent, removeOptionalComponent } from "@/lib/services/student-fee-service";
import { concessionReasonLabels, discountTypeLabels, scholarshipTypeLabels, type ConcessionReason, type DiscountType, type ScholarshipType } from "@/lib/types/fees";
import { paymentMethodLabels, paymentStatusLabels } from "@/lib/types/payments";
import type { TimelineEvent } from "@/lib/types/common";
import type { Student } from "@/lib/types/students";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };
const CURRENT_SESSION_FALLBACK = "2026-2027";

export function FeesTab({ student }: { student: Student }) {
  const db = useSisStore();
  const structures = useFeeStructures();
  const payments = usePayments(student.id);
  const receipts = useReceipts(student.id);
  const discounts = useDiscounts(student.id);
  const scholarships = useScholarships(student.id);
  const credits = useCreditBalances(student.id);
  const { can } = usePermissions();
  const canManage = can("fees.manageStructures") || can("fees.assign");

  const [drawer, setDrawer] = useState<"discount" | "scholarship" | "concession" | "credit" | "adhoc" | null>(null);
  const [discountType, setDiscountType] = useState<DiscountType>("custom");
  const [discountName, setDiscountName] = useState("");
  const [discountPercent, setDiscountPercent] = useState(10);
  const [scholarshipType, setScholarshipType] = useState<ScholarshipType>("merit");
  const [scholarshipName, setScholarshipName] = useState("");
  const [scholarshipPercent, setScholarshipPercent] = useState(15);
  const [concessionReason, setConcessionReason] = useState<ConcessionReason>("financial-hardship");
  const [concessionDescription, setConcessionDescription] = useState("");
  const [concessionAmount, setConcessionAmount] = useState(1000);
  const [creditAmount, setCreditAmount] = useState(500);
  const [creditNote, setCreditNote] = useState("");
  const [adhocLabel, setAdhocLabel] = useState("");
  const [adhocAmount, setAdhocAmount] = useState(500);
  const [adhocDueDate, setAdhocDueDate] = useState("");

  const items = db.studentFeeItems.filter((i) => i.studentId === student.id && i.status !== "cancelled");
  const assignment = db.studentFeeAssignments.find((a) => a.studentId === student.id && a.status === "active");
  const structure = structures.find((s) => s.id === assignment?.structureId);
  const session = assignment?.session ?? student.session ?? CURRENT_SESSION_FALLBACK;

  const billed = sumMoney(items.map((i) => i.billedAmount), "INR");
  const paid = sumMoney(items.map((i) => i.paidAmount), "INR");
  const pending = totalOutstanding(items.filter((i) => i.status === "pending" || i.status === "partial"));
  const overdue = totalOverdue(items);
  const discountTotal = sumMoney(items.map((i) => i.discountAmount), "INR");
  const scholarshipTotal = sumMoney(items.map((i) => i.scholarshipAmount), "INR");
  const availableCredit = sumMoney(
    credits.map((c) => ({ minorUnits: c.amount.minorUnits - c.consumedAmount.minorUnits, currency: c.amount.currency })),
    "INR",
  );
  const nextDue = [...items].filter((i) => i.status === "pending" || i.status === "partial").sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0];

  const optionalAssigned = structure?.components.filter((c) => c.optional && assignment?.optionalComponentIds.includes(c.id)) ?? [];

  const timelineEvents: TimelineEvent[] = db.financialAuditLog
    .filter((a) => a.subjectId === student.id)
    .map((a) => ({ id: a.id, subjectId: student.id, category: "fees" as const, title: a.summary, actorName: a.actorName, actorRole: a.actorRole, createdAt: a.createdAt }));

  function applicableComponentIds() {
    return [...new Set(items.map((i) => i.componentId))];
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total billed" value={formatMoney(billed, { compact: true })} icon={Wallet} tone="neutral" />
        <StatTile label="Paid" value={formatMoney(paid, { compact: true })} tone="success" />
        <StatTile label="Pending" value={formatMoney(pending, { compact: true })} tone={pending.minorUnits > 0 ? "warning" : "success"} />
        <StatTile label="Overdue" value={formatMoney(overdue, { compact: true })} tone={overdue.minorUnits > 0 ? "error" : "success"} />
        <StatTile label="Discounts" value={formatMoney(discountTotal, { compact: true })} tone="info" />
        <StatTile label="Scholarships" value={formatMoney(scholarshipTotal, { compact: true })} tone="info" />
        <StatTile label="Available credit" value={formatMoney(availableCredit, { compact: true })} tone={availableCredit.minorUnits > 0 ? "success" : "neutral"} />
        <StatTile label="Next due" value={nextDue ? formatDate(nextDue.dueDate) : "—"} hint={nextDue ? formatMoney(netDueForItem(nextDue), { compact: true }) : undefined} tone="neutral" />
      </div>

      <div className="flex flex-wrap items-center gap-xs print:hidden">
        {can("fees.record") && (
          <Button asChild size="sm">
            <Link href={`/fees/collection/new?studentId=${student.id}`}>
              <Wallet className="size-3.5" />
              Record payment
            </Link>
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="size-3.5" />
          Print statement
        </Button>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <MoreHorizontal className="size-3.5" />
                More actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => setDrawer("adhoc")}>
                <Plus className="size-3.5" /> Add fee
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDrawer("discount")}>
                <Gift className="size-3.5" /> Apply discount
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDrawer("scholarship")}>
                <Gift className="size-3.5" /> Apply scholarship
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDrawer("concession")}>
                <Gift className="size-3.5" /> Add concession
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDrawer("credit")}>
                <Plus className="size-3.5" /> Add credit
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/fees/payment-links?studentId=${student.id}`}>
                  <ReceiptText className="size-3.5" /> Create payment link
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/fees/refunds?studentId=${student.id}`}>
                  <ReceiptText className="size-3.5" /> Raise refund
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {!assignment && (
        <p className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/8 p-sm text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          No active fee structure assigned. Use{" "}
          <Link href="/fees/assignments" className="underline underline-offset-2">
            Fee assignment
          </Link>{" "}
          to bill this student.
        </p>
      )}

      {optionalAssigned.length > 0 && canManage && (
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Optional services</h3>
          <div className="flex flex-col gap-1">
            {optionalAssigned.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  {c.label} — {formatMoney(c.amount)}
                </span>
                <Button size="sm" variant="ghost" className="text-error" onClick={() => removeOptionalComponent(student.id, c.id, ACTOR)}>
                  <X className="size-3.5" />
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border p-sm">
        <h3 className="mb-xs text-sm font-semibold text-foreground">Fee schedule</h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fee items yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {[...items]
              .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
              .map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-sm text-sm">
                  <span className="min-w-0 truncate text-foreground">{item.label}</span>
                  <span className="flex shrink-0 items-center gap-sm text-xs">
                    <span className="text-muted-foreground">{formatDate(item.dueDate)}</span>
                    <span className="font-medium text-foreground">{formatMoney(netDueForItem(item))}</span>
                    <Badge tone={item.status === "paid" ? "success" : item.status === "overdue" ? "error" : item.status === "partial" ? "warning" : "neutral"}>{item.status}</Badge>
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Payment history</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {[...payments]
                .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1))
                .map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {paymentMethodLabels[p.method]} · {formatDate(p.paidAt)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{formatMoney(p.amount)}</span>
                      <Badge tone={p.status === "successful" ? "success" : p.status === "failed" ? "error" : "neutral"}>{paymentStatusLabels[p.status]}</Badge>
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Receipts</h3>
          {receipts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No receipts issued yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {receipts.map((r) => (
                <li key={r.id}>
                  <Link href={`/fees/receipts/${r.id}`} className="flex items-center justify-between rounded-md px-1 py-0.5 text-sm outline-none hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="text-foreground">{r.receiptNumber}</span>
                    <span className="font-medium text-foreground">{formatMoney(r.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(discounts.length > 0 || scholarships.length > 0) && (
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Discounts &amp; scholarships</h3>
          <ul className="flex flex-col gap-1">
            {discounts.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  {d.name} ({discountTypeLabels[d.type]})
                </span>
                <Badge tone="info">{d.percent ? `${d.percent}%` : formatMoney(d.amount!)}</Badge>
              </li>
            ))}
            {scholarships.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  {s.name} ({scholarshipTypeLabels[s.type]})
                </span>
                <Badge tone="info">{s.percent ? `${s.percent}%` : formatMoney(s.amount!)}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="print:hidden">
        <h3 className="mb-xs text-sm font-semibold text-foreground">Activity</h3>
        <TimelineList events={timelineEvents} emptyMessage="No financial activity recorded yet." />
      </div>

      <DetailDrawer open={drawer === "discount"} onOpenChange={(open) => !open && setDrawer(null)} title="Apply discount" description="Reduces every unpaid fee item for this student">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="disc-name">Discount name</Label>
            <Input id="disc-name" value={discountName} onChange={(e) => setDiscountName(e.target.value)} placeholder="e.g. Sibling discount" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
              <SelectTrigger aria-label="Discount type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(discountTypeLabels) as DiscountType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {discountTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="disc-percent">Percent off</Label>
            <Input id="disc-percent" type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} />
          </div>
          <Button
            disabled={!discountName.trim()}
            onClick={() => {
              applyDiscountToStudent({ studentId: student.id, name: discountName.trim(), type: discountType, percent: discountPercent, applicableComponentIds: applicableComponentIds(), session }, ACTOR);
              setDrawer(null);
              setDiscountName("");
            }}
          >
            Apply discount
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={drawer === "scholarship"} onOpenChange={(open) => !open && setDrawer(null)} title="Apply scholarship" description="Reduces every unpaid fee item for this student">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="schol-name">Scholarship name</Label>
            <Input id="schol-name" value={scholarshipName} onChange={(e) => setScholarshipName(e.target.value)} placeholder="e.g. Academic merit scholarship" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={scholarshipType} onValueChange={(v) => setScholarshipType(v as ScholarshipType)}>
              <SelectTrigger aria-label="Scholarship type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(scholarshipTypeLabels) as ScholarshipType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {scholarshipTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="schol-percent">Percent off</Label>
            <Input id="schol-percent" type="number" min={0} max={100} value={scholarshipPercent} onChange={(e) => setScholarshipPercent(Number(e.target.value))} />
          </div>
          <Button
            disabled={!scholarshipName.trim()}
            onClick={() => {
              applyScholarshipToStudent({ studentId: student.id, name: scholarshipName.trim(), type: scholarshipType, percent: scholarshipPercent, applicableComponentIds: applicableComponentIds(), session }, ACTOR);
              setDrawer(null);
              setScholarshipName("");
            }}
          >
            Apply scholarship
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={drawer === "concession"} onOpenChange={(open) => !open && setDrawer(null)} title="Add concession" description="A fixed-amount waiver, typically approved for a specific reason">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Reason</Label>
            <Select value={concessionReason} onValueChange={(v) => setConcessionReason(v as ConcessionReason)}>
              <SelectTrigger aria-label="Concession reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(concessionReasonLabels) as ConcessionReason[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {concessionReasonLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="conc-desc">Description</Label>
            <Input id="conc-desc" value={concessionDescription} onChange={(e) => setConcessionDescription(e.target.value)} placeholder="Approved by whom, and why" />
          </div>
          <div>
            <Label htmlFor="conc-amount">Amount (₹)</Label>
            <Input id="conc-amount" type="number" min={0} value={concessionAmount} onChange={(e) => setConcessionAmount(Number(e.target.value))} />
          </div>
          <Button
            disabled={!concessionDescription.trim()}
            onClick={() => {
              applyConcessionToStudent({ studentId: student.id, reason: concessionReason, description: concessionDescription.trim(), amount: { minorUnits: concessionAmount * 100, currency: "INR" }, applicableComponentIds: applicableComponentIds() }, ACTOR);
              setDrawer(null);
              setConcessionDescription("");
            }}
          >
            Add concession
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={drawer === "credit"} onOpenChange={(open) => !open && setDrawer(null)} title="Add credit" description="Adds a usable credit balance to this student's account">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="credit-amount">Amount (₹)</Label>
            <Input id="credit-amount" type="number" min={0} value={creditAmount} onChange={(e) => setCreditAmount(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="credit-note">Note</Label>
            <Input id="credit-note" value={creditNote} onChange={(e) => setCreditNote(e.target.value)} placeholder="Reason for this credit" />
          </div>
          <Button
            disabled={creditAmount <= 0}
            onClick={() => {
              addManualCredit(student.id, creditAmount, creditNote.trim() || "Manual credit", ACTOR);
              setDrawer(null);
              setCreditNote("");
            }}
          >
            Add credit
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={drawer === "adhoc"} onOpenChange={(open) => !open && setDrawer(null)} title="Add fee" description="A one-off charge outside the student's regular fee structure">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="adhoc-label">Description</Label>
            <Input id="adhoc-label" value={adhocLabel} onChange={(e) => setAdhocLabel(e.target.value)} placeholder="e.g. Replacement ID card" />
          </div>
          <div>
            <Label htmlFor="adhoc-amount">Amount (₹)</Label>
            <Input id="adhoc-amount" type="number" min={0} value={adhocAmount} onChange={(e) => setAdhocAmount(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="adhoc-due">Due date</Label>
            <Input id="adhoc-due" type="date" value={adhocDueDate} onChange={(e) => setAdhocDueDate(e.target.value)} />
          </div>
          <Button
            disabled={!adhocLabel.trim() || !adhocDueDate}
            onClick={() => {
              addAdHocFeeItem(student.id, session, adhocLabel.trim(), adhocAmount, adhocDueDate, ACTOR);
              setDrawer(null);
              setAdhocLabel("");
            }}
          >
            Add fee
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
