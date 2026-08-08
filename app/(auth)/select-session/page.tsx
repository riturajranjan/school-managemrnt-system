import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";
import { requireUser } from "@/lib/server/context";
import { deriveContextChoices } from "@/lib/server/auth/onboarding";
import { prisma } from "@/lib/db/prisma";

// Real academic-session listing for the user's accessible schools. The current
// session is auto-selected by the resolver, so this page is informational: it
// surfaces real AcademicSession rows (no mock) and lets the user continue.
export default async function SelectSessionPage() {
  const user = await requireUser();
  const choices = await deriveContextChoices(user.id);
  if (!choices) redirect("/access-denied");

  const sessions = await prisma.academicSession.findMany({
    where: { schoolId: { in: choices.schools.map((s) => s.id) }, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, isCurrent: true, status: true },
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
  });

  return (
    <AuthCenter>
      <AuthCard>
        <AuthHeader title="Academic session" subtitle="Choose which session to work in." />
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <Link
              key={s.id} href="/"
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition hover:border-primary/50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: s.isCurrent ? "#16a34a" : "#64748b" }}><CalendarRange className="size-4" /></span>
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{s.name}</span>{!s.isCurrent && <span className="block text-xs text-muted-foreground">Historical · read-only context</span>}</span>
              <Badge tone={s.isCurrent ? "success" : "neutral"} className="ml-auto mr-1">{s.isCurrent ? "Current" : "Past"}</Badge>
            </Link>
          ))}
          {sessions.length === 0 && <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No academic sessions configured yet.</p>}
        </div>
        <AuthLinkRow><AuthLink href="/select-branch">Change branch</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthCenter>
  );
}
