"use client";

// Phase 9W.2 — Student account foundation. This is deliberately NOT a student
// portal: no academic/attendance/fees/library/etc. data is surfaced here. It
// exists only so a real, provisioned Student login resolves to something
// honest instead of the staff-oriented main dashboard (which assumes a Staff
// profile) or a fabricated feature set. Reads GET /api/me/student-profile,
// which resolves the real Student record by Student.userId === caller —
// identity-scoped, not permission-scoped (the STUDENT role holds zero
// permissions by design). A full student portal is a future phase.
import { GraduationCap } from "lucide-react";
import { useApiResource } from "@/lib/hooks/api/use-api";

type MyStudentProfile = {
  id: string;
  name: string;
  admissionNumber: string;
  classLabel: string | null;
  sectionLabel: string | null;
  status: string;
};

export default function StudentAccountFoundationPage() {
  const { data, loading, error } = useApiResource<MyStudentProfile>(
    "/api/me/student-profile",
  );

  return (
    <div className="mx-auto flex flex-col items-center gap-md px-md py-3xl text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <GraduationCap className="size-6" />
      </span>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your account…</p>
      ) : error ? (
        <>
          <h1 className="text-lg font-semibold text-foreground">
            Account not linked
          </h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </>
      ) : (
        <>
          <h1 className="text-lg font-semibold text-foreground">
            Welcome, {data?.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Admission No. {data?.admissionNumber}
            {data?.classLabel
              ? ` · ${data.classLabel}${data.sectionLabel ? ` ${data.sectionLabel}` : ""}`
              : ""}
          </p>
          <div className="mt-md rounded-lg border border-dashed border-border bg-surface px-md py-md text-sm text-muted-foreground">
            Your account is set up and this is a real login — but the student
            portal (grades, homework, attendance, fees) is not built yet. It is
            a planned future phase, not something this page fakes.
          </div>
        </>
      )}
    </div>
  );
}
