import { Badge } from "@/components/ui/badge";
import type { AdmissionApplication } from "@/lib/types/admissions";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusTone = { pending: "warning", paid: "success", waived: "neutral", refunded: "info" } as const;

export function PaymentsTab({ application }: { application: AdmissionApplication }) {
  if (application.payments.length === 0) {
    return <p className="text-sm text-muted-foreground">No payments recorded for this application yet.</p>;
  }

  return (
    <div className="flex flex-col gap-sm">
      {application.payments.map((payment) => (
        <div key={payment.id} className="flex items-center justify-between rounded-lg border border-border p-sm">
          <div>
            <p className="text-sm font-medium text-foreground">{payment.label}</p>
            <p className="text-xs text-muted-foreground">
              {payment.dueDate ? `Due ${formatDate(payment.dueDate)}` : payment.paidAt ? `Paid ${formatDate(payment.paidAt)}` : ""}
              {payment.method ? ` · ${payment.method}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-sm">
            <span className="text-sm font-semibold text-foreground">{formatCurrency(payment.amount)}</span>
            <Badge tone={statusTone[payment.status]}>{payment.status}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
