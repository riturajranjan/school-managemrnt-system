"use client";

// Counselling Command Centre (Phase 9S) — real PostgreSQL/API cutover.
// Case metadata (who a case is about, its status) is non-confidential per
// the domain's own privacy model (see prisma/schema.prisma's Counseling
// doc-comment) — only session notes are confidential, so this panel does
// NOT redact student names the way the old mock did.
import Link from "next/link";
import { CalendarClock, HandHeart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PrivacyNotice } from "@/components/campus/privacy";
import { PermissionDenied } from "@/components/library/permission-denied";
import { useShell } from "@/components/shell/shell-context";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useCounselingCases, useCounselingDashboard } from "@/lib/hooks/api/use-counseling-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function CounsellingDashboardPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { activeSession } = useShell();
  const { data: dashboard } = useCounselingDashboard();
  const { data: openCases } = useCounselingCases({ status: "open" });

  if (!capabilitiesLoading && !hasServerPermission("counseling.view")) return <PermissionDenied action="view the counselling dashboard" role={roleLabels[role]} backHref="/counselling" />;
  const s = dashboard ?? { sessionsToday: 0, totalOpenCases: 0, totalActiveCases: 0, unassignedCases: 0, followUpsDue: 0 };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Counselling Command Centre</h1><p className="text-xs text-muted-foreground">Administrative overview · {activeSession}</p></div>
      <PrivacyNotice kind="counselling" />
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Sessions today" value={String(s.sessionsToday)} icon={CalendarClock} tone="neutral" />
        <StatTile label="Open cases" value={String(s.totalOpenCases)} tone="info" />
        <StatTile label="Active cases" value={String(s.totalActiveCases)} tone="neutral" />
        <StatTile label="Follow-ups due" value={String(s.followUpsDue)} icon={HandHeart} tone={s.followUpsDue > 0 ? "warning" : "success"} />
      </div>
      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Open cases</h2><Link href="/counselling/appointments" className="text-xs text-primary">All →</Link></div>
        {openCases.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">No open cases.</p> : (
          <div className="flex flex-col gap-xs">{openCases.slice(0, 8).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{c.studentName}</p><p className="truncate text-xs text-muted-foreground">{formatDate(c.openedAt)} · {c.assignedCounselorName ?? "Unassigned"}{c.concernCategory ? ` · ${c.concernCategory.replace("_", " ")}` : ""}</p></div>
              <Badge tone={c.status === "open" ? "warning" : "neutral"}>{c.status}</Badge>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}
