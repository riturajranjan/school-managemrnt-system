"use client";

// Real PostgreSQL/API cutover (Phase 9F) — reads GET /api/fees/reminders, a
// live-computed list of students with real overdue balances. HONEST: Student
// and Guardian have no linked User account in this system (see the
// Notification schema doc comment) and this repo has no SMS/WhatsApp/email
// provider — so there is no real in-app or external delivery channel yet.
// This is a queue the school can act on manually (call the guardian), never
// a simulated send.
import Link from "next/link";
import { Bell, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useFeeReminderCandidates } from "@/lib/hooks/api/use-fees-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency } from "@/lib/utils";

export default function RemindersPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: candidates, loading, error } = useFeeReminderCandidates();
  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Reminders</h1>
        <p className="text-xs text-muted-foreground">Students with overdue fees</p>
      </div>

      <p className="flex items-start gap-1.5 rounded-lg border border-info/30 bg-info/8 p-sm text-sm text-info">
        <Bell className="mt-0.5 size-4 shrink-0" />
        Automated reminders are not available yet — parents and students don&apos;t have linked accounts in this system, and no SMS/WhatsApp/email provider is configured. Use the contact details below to follow up manually.
      </p>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

      <div className="flex flex-col gap-sm">
        {(candidates ?? []).map((c) => (
          <div key={c.studentId} className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0">
              <Link href={`/students/${c.studentId}/fees`} className="truncate text-sm font-medium text-foreground hover:underline">
                {c.studentName}
              </Link>
              <p className="text-xs text-muted-foreground">
                {c.admissionNumber} · {c.oldestOverdueDays} days overdue · {c.guardianName ?? "No guardian on file"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-sm">
              <span className="text-sm font-medium text-error">{formatCurrency(c.overdueAmount)}</span>
              {c.guardianPhone ? (
                <a href={`tel:${c.guardianPhone}`} className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground">
                  <Phone className="size-3.5" />
                </a>
              ) : (
                <Badge tone="neutral">No phone</Badge>
              )}
            </div>
          </div>
        ))}
        {!loading && (candidates ?? []).length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No students are currently overdue.</p>}
      </div>
    </div>
  );
}
