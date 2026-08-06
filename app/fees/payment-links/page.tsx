"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Link2, Plus, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudents } from "@/lib/hooks/use-students";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, sumMoney } from "@/lib/finance/money";
import { outstandingForItem } from "@/lib/selectors/fee-item-insights";
import { cancelPaymentLink, createPaymentLink, isPaymentLinkExpired, simulateGatewayCallback } from "@/lib/services/payment-link-service";
import { paymentGatewayProviderLabels, type PaymentGatewayProvider } from "@/lib/types/payments";
import { formatDateTime } from "@/lib/utils";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };
const providers = Object.keys(paymentGatewayProviderLabels) as PaymentGatewayProvider[];

function CreateLinkDrawer({ open, onOpenChange, initialStudentId }: { open: boolean; onOpenChange: (v: boolean) => void; initialStudentId?: string }) {
  const students = useStudents();
  const db = useSisStore();
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set(initialStudentId ? [initialStudentId] : []));
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [recurring, setRecurring] = useState(false);

  const eligibleItems = db.studentFeeItems.filter((i) => selectedStudentIds.has(i.studentId) && (i.status === "pending" || i.status === "overdue" || i.status === "partial"));
  const amount = sumMoney(eligibleItems.map((i) => outstandingForItem(i)), "INR");

  function toggleStudent(id: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="Create payment link" description="Generates a shareable link covering every outstanding item for the selected student(s)">
      <div className="flex flex-col gap-sm">
        <div>
          <Label>Students</Label>
          <div className="max-h-48 overflow-y-auto rounded-md border border-border p-sm">
            {students
              .filter((s) => s.status === "active")
              .slice(0, 50)
              .map((s) => (
                <label key={s.id} className="flex min-h-9 items-center gap-1.5 text-sm text-foreground">
                  <Checkbox checked={selectedStudentIds.has(s.id)} onCheckedChange={() => toggleStudent(s.id)} />
                  {s.profile.firstName} {s.profile.lastName}
                </label>
              ))}
          </div>
        </div>
        <div>
          <Label htmlFor="expiry-days">Expires in (days)</Label>
          <Input id="expiry-days" type="number" min={1} value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))} />
        </div>
        <label className="flex items-center justify-between rounded-md border border-border p-sm">
          <span className="text-sm text-foreground">Set up as recurring mandate</span>
          <Switch checked={recurring} onCheckedChange={setRecurring} />
        </label>
        <div className="rounded-md border border-border p-sm text-sm">
          <span className="text-muted-foreground">Total amount</span>
          <p className="text-lg font-semibold text-foreground">{formatMoney(amount)}</p>
        </div>
        <Button
          disabled={selectedStudentIds.size === 0 || eligibleItems.length === 0}
          onClick={() => {
            createPaymentLink([...selectedStudentIds], eligibleItems.map((i) => i.id), amount, expiresInDays, ACTOR, recurring);
            onOpenChange(false);
          }}
        >
          <Link2 className="size-3.5" />
          Create link
        </Button>
      </div>
    </DetailDrawer>
  );
}

function PaymentLinksContent() {
  const searchParams = useSearchParams();
  const initialStudentId = searchParams.get("studentId") ?? undefined;
  const db = useSisStore();
  const students = useStudents();
  const { can } = usePermissions();
  const canManage = can("fees.managePaymentLinks") || can("fees.record");

  const [createOpen, setCreateOpen] = useState(false);

  function studentNames(ids: string[]) {
    return ids
      .map((id) => students.find((s) => s.id === id))
      .filter(Boolean)
      .map((s) => `${s!.profile.firstName} ${s!.profile.lastName}`)
      .join(", ");
  }

  const links = [...db.paymentLinks].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Payment links</h1>
          <p className="text-xs text-muted-foreground">Gateway-agnostic online payment requests — no gateway is wired up, so success/failure is simulated for demonstration</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Create link
          </Button>
        )}
      </div>

      {links.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
            <Link2 className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">No payment links created yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {links.map((link) => {
            const expired = isPaymentLinkExpired(link);
            const status = expired && link.status === "active" ? "expired" : link.status;
            return (
              <div key={link.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm">
                <div className="flex flex-wrap items-start justify-between gap-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{studentNames(link.studentIds) || link.studentIds.join(", ")}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {link.url} {link.recurring && "· Recurring mandate"}
                    </p>
                  </div>
                  <Badge tone={status === "paid" ? "success" : status === "active" ? "info" : status === "expired" ? "warning" : "error"}>{status}</Badge>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-sm text-xs text-muted-foreground">
                  <span>
                    {formatMoney(link.amount)} · Expires {formatDateTime(link.expiresAt)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigator.clipboard?.writeText(link.url)}
                    aria-label="Copy link"
                  >
                    <Copy className="size-3.5" />
                    Copy
                  </Button>
                </div>
                {canManage && status === "active" && (
                  <div className="flex flex-wrap items-center gap-xs border-t border-border pt-sm">
                    <span className="text-xs text-muted-foreground">Simulate gateway callback:</span>
                    {providers.slice(0, 3).map((p) => (
                      <Button key={p} size="sm" variant="outline" onClick={() => simulateGatewayCallback(link.id, p, "success", ACTOR)}>
                        <CheckCircle2 className="size-3.5 text-success" />
                        {paymentGatewayProviderLabels[p]}
                      </Button>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => simulateGatewayCallback(link.id, "razorpay", "failure", ACTOR)}>
                      <XCircle className="size-3.5 text-error" />
                      Simulate failure
                    </Button>
                    <Button size="sm" variant="ghost" className="text-error" onClick={() => cancelPaymentLink(link.id, ACTOR)}>
                      Cancel link
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="flex items-start gap-1.5 rounded-lg border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        This demo has no real payment gateway credentials or a server endpoint to receive webhooks. The gateway callback is simulated client-side to demonstrate the full link → payment → receipt flow; a production integration would verify the provider&apos;s webhook signature server-side before ever crediting a fee item.
      </p>

      <CreateLinkDrawer open={createOpen} onOpenChange={setCreateOpen} initialStudentId={initialStudentId} />
    </div>
  );
}

export default function PaymentLinksPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <PaymentLinksContent />
    </Suspense>
  );
}
