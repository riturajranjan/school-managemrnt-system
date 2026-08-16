"use client";

// Phase 9G: the mock multi-step expense form (vendor linkage, tax, submit→
// approve→pay workflow) had no real backing — Vendors/Purchase Orders are
// out of this phase's scope. Redirect to the real Expenses page, whose
// "New expense" drawer posts a real journal entry immediately.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewExpenseRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/accounting/expenses");
  }, [router]);
  return <div className="py-2xl text-center text-sm text-muted-foreground">Redirecting to Expenses…</div>;
}
