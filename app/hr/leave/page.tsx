"use client";

// This page was a mock (useSisStore + lib/services/hr-service) duplicate of a
// concept that already has a real implementation: staff leave requests are
// real at /attendance/leave (LeaveType/LeaveRequest — Phase 9E, GET/POST
// /api/leave/*). Redirect there rather than keep two competing leave pages.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HrLeaveRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/attendance/leave");
  }, [router]);
  return <div className="py-2xl text-center text-sm text-muted-foreground">Redirecting to Leave…</div>;
}
