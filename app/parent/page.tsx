"use client";

// Phase 9W.2 — Guardian (parent) account foundation. Deliberately NOT a
// parent portal — see app/student/page.tsx for the identical rationale on the
// Student side. Reads GET /api/me/guardian-children, which resolves the real
// Guardian record by Guardian.userId === caller and its real StudentGuardian
// links — identity-scoped, not permission-scoped (GUARDIAN holds zero
// permissions by design). A full parent portal is a future phase.
import { Users } from "lucide-react";
import { useApiResource } from "@/lib/hooks/api/use-api";

type MyGuardianChild = {
  id: string;
  name: string;
  admissionNumber: string;
  classLabel: string | null;
  sectionLabel: string | null;
  status: string;
  relation: string;
};

export default function ParentAccountFoundationPage() {
  const { data, loading, error } = useApiResource<MyGuardianChild[]>(
    "/api/me/guardian-children",
  );

  return (
    <div className="mx-auto flex flex-col items-center gap-md px-md py-3xl text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Users className="size-6" />
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
          <h1 className="text-lg font-semibold text-foreground">Welcome</h1>
          <p className="text-sm text-muted-foreground">
            Linked to {data?.length ?? 0} child
            {(data?.length ?? 0) === 1 ? "" : "ren"}:
          </p>
          <div className="flex w-full flex-col gap-xs">
            {data?.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-border bg-surface p-sm text-left">
                <p className="text-sm font-medium text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.relation} · Admission No. {c.admissionNumber}
                  {c.classLabel
                    ? ` · ${c.classLabel}${c.sectionLabel ? ` ${c.sectionLabel}` : ""}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-md rounded-lg border border-dashed border-border bg-surface px-md py-md text-sm text-muted-foreground">
            Your account is set up and this is a real login — but the parent
            portal (fees, attendance, transport, communication) is not built
            yet. It is a planned future phase, not something this page fakes.
          </div>
        </>
      )}
    </div>
  );
}
