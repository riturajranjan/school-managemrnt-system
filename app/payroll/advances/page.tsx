"use client";

// Phase 9H: honestly deferred. This route used to simulate salary/emergency
// advances with a monthly recovery schedule — no real advance policy exists
// in this repo, so that was fabricated business data and has been removed
// rather than migrated. See prisma/schema.prisma's Phase 9H doc comment.
import { Receipt } from "lucide-react";

export default function PayrollAdvancesPage() {
  return (
    <div className="mx-auto flex flex-col items-center gap-sm px-md py-2xl text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
        <Receipt className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">
        Salary advances aren&apos;t available yet
      </p>
      <p className="text-xs text-muted-foreground">
        This school hasn&apos;t configured an advance policy. Advance issuance
        and recovery-against-payroll require rules this product doesn&apos;t
        define yet.
      </p>
    </div>
  );
}
