"use client";

import Link from "next/link";
import { use, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Landmark,
  Loader2,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, sumMoney } from "@/lib/finance/money";
import { outstandingForItem } from "@/lib/selectors/fee-item-insights";
import {
  isPaymentLinkExpired,
  simulateGatewayCallback,
  type GatewayOutcome,
} from "@/lib/services/payment-link-service";
import type { PaymentGatewayProvider } from "@/lib/types/payments";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Parent (self-service)", role: "Parent" };
type ScreenState = "review" | "processing" | "success" | "failed";

const methods: {
  key: PaymentGatewayProvider;
  label: string;
  icon: typeof CreditCard;
}[] = [
  { key: "razorpay", label: "UPI", icon: Smartphone },
  { key: "stripe", label: "Card", icon: CreditCard },
  { key: "bank-hosted", label: "Netbanking", icon: Landmark },
];

/** Mobile-first parent/student payment screen — this is what a family opens
 * from a payment link. In production this would be an unauthenticated route
 * on its own subdomain with no admin shell; it lives inside the existing app
 * shell here since Phase 5 must reuse the existing route-group structure
 * rather than introduce a second layout. */
export default function ParentPaymentPage({
  params,
}: {
  params: Promise<{ linkId: string }>;
}) {
  const { linkId } = use(params);
  const db = useSisStore();
  const [screen, setScreen] = useState<ScreenState>("review");
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentGatewayProvider>("razorpay");
  const [failureReason, setFailureReason] = useState<string | null>(null);

  const link = db.paymentLinks.find((l) => l.id === linkId);

  if (!link) {
    return (
      <div className="mx-auto flex  flex-col items-center gap-sm py-2xl text-center">
        <AlertTriangle className="size-8 text-error" />
        <p className="text-sm font-medium text-foreground">
          Payment link not found
        </p>
        <p className="text-xs text-muted-foreground">
          This link may have been mistyped or removed.
        </p>
      </div>
    );
  }

  const expired = isPaymentLinkExpired(link);
  const students = link.studentIds
    .map((id) => db.students.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);
  const items = db.studentFeeItems.filter((i) => link.itemIds.includes(i.id));

  function studentItems(studentId: string) {
    return items.filter((i) => i.studentId === studentId);
  }

  async function pay() {
    setScreen("processing");
    setFailureReason(null);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const outcome: GatewayOutcome = "success";
    const result = simulateGatewayCallback(
      linkId,
      selectedMethod,
      outcome,
      ACTOR,
    );
    if (result.ok) {
      setScreen("success");
    } else {
      setFailureReason(result.error);
      setScreen("failed");
    }
  }

  return (
    <div className="mx-auto flex w-full  flex-col gap-md py-md">
      <div className="flex items-center gap-sm">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          N
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Novyra Public School
          </p>
          <p className="text-xs text-muted-foreground">Secure fee payment</p>
        </div>
      </div>

      {link.status === "paid" ? (
        <StatusCard
          icon={CheckCircle2}
          tone="success"
          title="Already paid"
          description={
            link.paidAt
              ? `This link was paid on ${formatDate(link.paidAt)}.`
              : "This link has already been paid."
          }
        />
      ) : link.status === "cancelled" ? (
        <StatusCard
          icon={XCircle}
          tone="error"
          title="Link cancelled"
          description="This payment link is no longer valid. Please contact the school office."
        />
      ) : expired || link.status === "expired" ? (
        <StatusCard
          icon={Clock}
          tone="warning"
          title="Link expired"
          description="This payment link has expired. Please request a new one from the school office."
        />
      ) : screen === "success" ? (
        <StatusCard
          icon={CheckCircle2}
          tone="success"
          title="Payment successful"
          description="A receipt has been generated for each child. You'll receive it by email and on the parent portal."
        />
      ) : screen === "processing" ? (
        <div className="surface-3d flex flex-col items-center gap-sm rounded-lg border border-border bg-surface p-lg text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">
            Processing payment…
          </p>
          <p className="text-xs text-muted-foreground">
            Please don&apos;t close this window.
          </p>
        </div>
      ) : (
        <>
          {screen === "failed" && (
            <div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/8 p-sm text-xs text-error">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {failureReason ?? "Payment failed. Please try again."}
              </span>
            </div>
          )}

          <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <p className="text-xs font-medium text-muted-foreground">
              Paying for
            </p>
            {students.map((student) => {
              const rows = studentItems(student.id);
              const subtotal = sumMoney(
                rows.map(outstandingForItem),
                link.amount.currency,
              );
              return (
                <div
                  key={student.id}
                  className="rounded-lg border border-border p-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {student.profile.firstName} {student.profile.lastName}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {formatMoney(subtotal)}
                    </p>
                  </div>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {rows.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.label}</span>
                        <span>{formatMoney(outstandingForItem(item))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t border-border pt-sm text-base font-semibold text-foreground">
              <span>Total due</span>
              <span>{formatMoney(link.amount)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-xs">
            <p className="text-xs font-medium text-muted-foreground">
              Payment method
            </p>
            <div className="grid grid-cols-3 gap-xs">
              {methods.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedMethod(key)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-sm text-xs font-medium transition-colors ${selectedMethod === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Button className="h-12 w-full text-base" onClick={pay}>
            Pay {formatMoney(link.amount)}
          </Button>

          <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3" />
            Secured by {methods.find((m) => m.key === selectedMethod)?.label} ·
            expires {formatDate(link.expiresAt)}
          </p>
        </>
      )}

      <Link
        href="/fees/payment-links"
        className="text-center text-xs text-muted-foreground underline-offset-2 hover:underline">
        Staff view: manage this link
      </Link>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: typeof CheckCircle2;
  tone: "success" | "warning" | "error";
  title: string;
  description: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-error";
  return (
    <div className="surface-3d flex flex-col items-center gap-sm rounded-lg border border-border bg-surface p-lg text-center">
      <Icon className={`size-10 ${toneClass}`} />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
