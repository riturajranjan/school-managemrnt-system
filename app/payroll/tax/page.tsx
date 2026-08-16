"use client";

// Phase 9H: honestly deferred. This route used to simulate statutory tax
// (TDS) withholding — no real PF/ESI/TDS/professional-tax rule table exists
// in this repo, so that was a fabricated statutory calculation and has been
// removed rather than migrated. See prisma/schema.prisma's Phase 9H doc
// comment: inventing these rules was explicitly out of scope for Payroll V1.
import { Percent } from "lucide-react";

export default function PayrollTaxPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-sm px-md py-2xl text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
        <Percent className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">Tax summary isn&apos;t available yet</p>
      <p className="text-xs text-muted-foreground">This school hasn&apos;t configured a statutory tax policy (PF/ESI/TDS/professional tax). Payroll deductions here are limited to the components an administrator defines explicitly.</p>
    </div>
  );
}
