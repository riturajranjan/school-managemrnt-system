"use client";

import Link from "next/link";
import { use, useState } from "react";
import { AlertTriangle, Copy, Mail, MessageSquare, Printer, QrCode, RefreshCcw, ShieldCheck, Smartphone, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useStudentGuardians } from "@/lib/hooks/use-students";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney } from "@/lib/finance/money";
import { addReceiptNote, cancelReceipt, reissueReceipt, simulateSendReceipt } from "@/lib/services/receipt-service";
import { paymentMethodLabels, receiptStatusLabels } from "@/lib/types/payments";
import { formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const ACTOR = { name: "Priya Nair", role: "Cashier" };
type PaperFormat = "a4" | "a5" | "thermal";

const paperWidths: Record<PaperFormat, string> = { a4: "max-w-[210mm]", a5: "max-w-[148mm]", thermal: "max-w-[80mm]" };

export default function ReceiptPage({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = use(params);
  const db = useSisStore();
  const classes = useManagedClasses();
  const { can } = usePermissions();
  const canManage = can("fees.record") || can("fees.manageStructures");

  const [format, setFormat] = useState<PaperFormat>("a4");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  const receipt = db.receipts.find((r) => r.id === receiptId);
  const student = db.students.find((s) => s.id === receipt?.studentId);
  const guardians = useStudentGuardians(receipt?.studentId);

  if (!receipt || !student) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Receipt not found</p>
        <Button asChild variant="outline">
          <Link href="/fees/receipts">Back to receipts</Link>
        </Button>
      </div>
    );
  }

  const schoolClass = classes.find((c) => c.id === student.classId);
  const section = schoolClass?.sections.find((s) => s.id === student.sectionId);
  const guardian = guardians[0];
  const auditHistory = db.financialAuditLog.filter((a) => a.subjectId === student.id && a.summary.includes(receipt.receiptNumber));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-sm print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Receipt {receipt.receiptNumber}</h1>
          <p className="text-xs text-muted-foreground">
            {student.profile.firstName} {student.profile.lastName} · {formatDate(receipt.issuedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-xs">
          <Badge tone={receipt.status === "issued" ? "success" : receipt.status === "cancelled" || receipt.status === "refunded" ? "error" : "neutral"}>{receiptStatusLabels[receipt.status]}</Badge>
          <div className="flex items-center gap-1 rounded-md bg-surface-secondary p-1">
            {(["a4", "a5", "thermal"] as PaperFormat[]).map((f) => (
              <button key={f} type="button" onClick={() => setFormat(f)} className={cn("min-h-8 rounded-md px-sm text-xs font-medium uppercase transition-colors", format === f ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")}>
                {f}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print / Save as PDF
          </Button>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  More actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => simulateSendReceipt(receipt.id, "email", ACTOR)}>
                  <Mail className="size-3.5" /> Email receipt
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => simulateSendReceipt(receipt.id, "parent-portal", ACTOR)}>
                  <Smartphone className="size-3.5" /> Send via parent portal
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => simulateSendReceipt(receipt.id, "whatsapp", ACTOR)}>
                  <MessageSquare className="size-3.5" /> Send via WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setNoteOpen(true)}>Add note</DropdownMenuItem>
                {receipt.status !== "cancelled" && receipt.status !== "replaced" && (
                  <DropdownMenuItem onSelect={() => reissueReceipt(receipt.id, ACTOR)}>
                    <RefreshCcw className="size-3.5" /> Reissue
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href={`/fees/refunds?studentId=${student.id}&paymentId=${receipt.paymentId}`}>Raise refund</Link>
                </DropdownMenuItem>
                {receipt.status === "issued" && (
                  <DropdownMenuItem onSelect={() => setCancelOpen(true)} className="text-error">
                    <X className="size-3.5" /> Cancel receipt
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {receipt.status === "cancelled" && (
        <p className="flex items-center gap-1.5 rounded-lg border border-error/30 bg-error/8 p-sm text-sm text-error print:hidden">
          <AlertTriangle className="size-4 shrink-0" /> This receipt has been cancelled and is void.
        </p>
      )}
      {receipt.status === "replaced" && (
        <p className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/8 p-sm text-sm text-warning print:hidden">
          <AlertTriangle className="size-4 shrink-0" /> This receipt has been replaced by a reissued copy.
        </p>
      )}

      {/* The document itself — a fixed white page surface even in dark theme, matching the printed/PDF output. */}
      <div className={cn("mx-auto w-full rounded-lg border border-border bg-white p-lg text-[#111827] shadow-card print:rounded-none print:border-0 print:shadow-none", paperWidths[format], format === "thermal" && "font-mono text-xs")}>
        <div className="mb-md flex items-center justify-between border-b border-[#e5e7eb] pb-sm">
          <div className="flex items-center gap-sm">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#022c43] text-base font-bold text-white">N</span>
            <div>
              <p className="text-base font-bold">Novyra Public School</p>
              <p className="text-xs text-[#6b7280]">Fee receipt · {receipt.session}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{receipt.receiptNumber}</p>
            <p className="text-xs text-[#6b7280]">{formatDateTime(receipt.issuedAt)}</p>
          </div>
        </div>

        <div className="mb-md grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Student</p>
            <p className="font-medium">
              {student.profile.firstName} {student.profile.lastName}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Class</p>
            <p className="font-medium">
              {schoolClass?.name}
              {section ? `-${section.name}` : ""}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Guardian</p>
            <p className="font-medium">{guardian ? `${guardian.firstName} ${guardian.lastName}` : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Admission no.</p>
            <p className="font-medium">{student.admissionNumber}</p>
          </div>
        </div>

        <div className="mb-md overflow-x-auto">
          <table className="w-full min-w-[280px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-left text-[10px] uppercase text-[#6b7280]">
                <th className="py-1">Description</th>
                <th className="py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item, i) => (
                <tr key={i} className="border-b border-[#f3f4f6]">
                  <td className="py-1">{item.label}</td>
                  <td className="py-1 text-right">{formatMoney(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-md flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-[#6b7280]">Payment method</span>
            <span className="font-medium">{paymentMethodLabels[receipt.method]}</span>
          </div>
          {receipt.discount.minorUnits > 0 && (
            <div className="flex justify-between">
              <span className="text-[#6b7280]">Discount</span>
              <span className="font-medium">-{formatMoney(receipt.discount)}</span>
            </div>
          )}
          {receipt.fine.minorUnits > 0 && (
            <div className="flex justify-between">
              <span className="text-[#6b7280]">Fine</span>
              <span className="font-medium">{formatMoney(receipt.fine)}</span>
            </div>
          )}
          {receipt.tax.minorUnits > 0 && (
            <div className="flex justify-between">
              <span className="text-[#6b7280]">Tax</span>
              <span className="font-medium">{formatMoney(receipt.tax)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-[#e5e7eb] pt-1 text-base font-bold">
            <span>Total</span>
            <span>{formatMoney(receipt.total)}</span>
          </div>
        </div>

        {receipt.notes && <p className="mb-md text-xs text-[#6b7280]">Notes: {receipt.notes}</p>}

        <div className="mb-md mt-lg grid grid-cols-2 gap-sm text-center text-xs">
          <div className="border-t border-[#111827] pt-1">Cashier — {receipt.cashierName}</div>
          <div className="border-t border-[#111827] pt-1">Authorized signatory</div>
        </div>

        <div className="mb-md flex items-center gap-sm text-xs text-[#6b7280]">
          <span className="flex size-12 items-center justify-center rounded-md border border-dashed border-[#9ca3af]">
            <QrCode className="size-6" />
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="size-3.5" /> Scan to verify this receipt at novyra.edu.in/verify/{receipt.id}
          </span>
        </div>

        <p className="mt-lg border-t border-[#e5e7eb] pt-sm text-center text-[10px] text-[#6b7280]">This is a computer-generated receipt and does not require a physical signature.</p>
      </div>

      {auditHistory.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-md print:hidden">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Audit history</h2>
          <ul className="flex flex-col gap-1">
            {auditHistory.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{a.summary}</span>
                <span className="text-muted-foreground">
                  {a.actorName} · {formatDateTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DetailDrawer open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel this receipt?" description="The receipt becomes void but stays in history — this does not reverse the underlying payment or fee balances.">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="cancel-reason">Reason</Label>
            <Input id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why is this receipt being cancelled?" />
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              cancelReceipt(receipt.id, cancelReason.trim() || "No reason given", ACTOR);
              setCancelOpen(false);
              setCancelReason("");
            }}
          >
            <X className="size-3.5" />
            Cancel receipt
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={noteOpen} onOpenChange={setNoteOpen} title="Add note" description={`Receipt ${receipt.receiptNumber}`}>
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="receipt-note">Note</Label>
            <Input id="receipt-note" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          </div>
          <Button
            disabled={!noteText.trim()}
            onClick={() => {
              addReceiptNote(receipt.id, noteText.trim(), ACTOR);
              setNoteOpen(false);
              setNoteText("");
            }}
          >
            <Copy className="size-3.5" />
            Save note
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
