"use client";

// Phase 9F: the mock "Finance Command Centre" mixed fees with wider
// accounting concepts (income/expense pulse) that are out of this phase's
// scope (Accounting is a later phase). Redirect to the real Fee Reports page
// rather than fake a cross-domain finance dashboard.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FeeDashboardRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/fees/reports");
  }, [router]);
  return <div className="py-2xl text-center text-sm text-muted-foreground">Redirecting to Fee Reports…</div>;
}
