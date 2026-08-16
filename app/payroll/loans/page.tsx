"use client";

// Phase 9H: honestly deferred. This route used to simulate employee loan
// origination/recovery scheduling — no real lending policy (interest rules,
// approval workflow, recovery-against-payroll rules) exists in this repo,
// so that was fabricated business data and has been removed rather than
// migrated. See prisma/schema.prisma's Phase 9H doc comment.
import { Banknote } from "lucide-react";

export default function PayrollLoansPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-sm px-md py-2xl text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
        <Banknote className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">Employee loans aren&apos;t available yet</p>
      <p className="text-xs text-muted-foreground">This school hasn&apos;t configured a lending policy. Loan origination and recovery scheduling require rules this product doesn&apos;t define yet.</p>
    </div>
  );
}
