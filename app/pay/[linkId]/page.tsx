"use client";

// Phase 9F: honestly deferred. This route used to simulate a payment-gateway
// checkout (fake UPI/card/netbanking success) — no real gateway integration
// exists in this repo, so that was fake payment processing and has been
// removed rather than migrated. See app/fees/payment-links/page.tsx.
import { AlertTriangle } from "lucide-react";

export default function PayLinkPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-sm px-md py-2xl text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
        <AlertTriangle className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">Online payment isn&apos;t available yet</p>
      <p className="text-xs text-muted-foreground">This school hasn&apos;t configured an online payment gateway. Please contact the school office to pay this fee in person or by bank transfer.</p>
    </div>
  );
}
