"use client";

// This page was a mock (useSisStore + lib/services/hr-service) duplicate of a
// concept that already has a real implementation: staff attendance is real
// at /attendance/staff (StaffAttendanceRecord — Phase 9E, GET/POST
// /api/staff-attendance/*). Redirect there rather than keep two competing
// staff-attendance pages.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HrAttendanceRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/attendance/staff");
  }, [router]);
  return <div className="py-2xl text-center text-sm text-muted-foreground">Redirecting to Staff Attendance…</div>;
}
