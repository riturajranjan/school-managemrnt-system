"use client";

// Phase 9F: honestly deferred. No payment-gateway integration exists in this
// repo — a locally generated URL that does not actually process money is not
// a real payment link (see the Fees domain scoping notes). This page states
// that plainly instead of fabricating shareable links.
import { Link2 } from "lucide-react";

export default function PaymentLinksPage() {
  return (
    <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
        <Link2 className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">Payment links aren&apos;t available yet</p>
      <p className="max-w-sm text-xs text-muted-foreground">This requires a real online payment gateway integration, which isn&apos;t configured for this school yet. Fees can be collected and recorded manually from the Collection page.</p>
    </div>
  );
}
