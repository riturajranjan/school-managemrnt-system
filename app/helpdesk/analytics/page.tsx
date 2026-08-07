"use client";

import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { ticketCategoryLabels, ticketStatusLabels, type TicketCategory, type TicketStatus } from "@/lib/types/communication";

export default function HelpdeskAnalyticsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("helpdesk.view")) return <PermissionDenied action="view helpdesk analytics" role={roleLabels[role]} backHref="/helpdesk" />;

  const t = db.helpdeskTickets;
  const resolved = t.filter((x) => x.status === "resolved" || x.status === "closed").length;
  const resolutionRate = t.length ? Math.round((resolved / t.length) * 100) : 0;
  const urgent = t.filter((x) => x.priority === "urgent").length;

  const byCat = new Map<TicketCategory, number>();
  for (const x of t) byCat.set(x.category, (byCat.get(x.category) ?? 0) + 1);
  const maxCat = Math.max(1, ...byCat.values());

  const byStatus = new Map<TicketStatus, number>();
  for (const x of t) byStatus.set(x.status, (byStatus.get(x.status) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Helpdesk analytics</h1>
        <p className="text-xs text-muted-foreground">Volume, resolution and category distribution</p>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total tickets" value={String(t.length)} tone="neutral" />
        <StatTile label="Resolved" value={String(resolved)} tone="success" />
        <StatTile label="Resolution rate" value={`${resolutionRate}%`} tone={resolutionRate >= 70 ? "success" : "warning"} />
        <StatTile label="Urgent" value={String(urgent)} tone={urgent > 0 ? "error" : "success"} />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Ticket volume by category</h2>
          <div className="flex flex-col gap-sm">
            {[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <div key={cat} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm"><span className="text-foreground">{ticketCategoryLabels[cat]}</span><span className="text-muted-foreground">{count}</span></div>
                <MiniBar percent={(count / maxCat) * 100} toneClassName="bg-primary" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">By status</h2>
          <div className="flex flex-col gap-xs">
            {[...byStatus.entries()].map(([s, count]) => (
              <div key={s} className="flex items-center justify-between text-sm"><span className="text-foreground">{ticketStatusLabels[s]}</span><Badge tone="neutral">{count}</Badge></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
