"use client";

// Phase 9F: Concessions had no separate real backing — a concession is a
// DISCOUNT with a reason (see lib/server/fees/adjustments.ts's doc comment
// on the one canonical adjustment engine). Redirect rather than duplicate
// the Discounts page.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConcessionsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/fees/discounts");
  }, [router]);
  return <div className="py-2xl text-center text-sm text-muted-foreground">Redirecting to Discounts…</div>;
}
