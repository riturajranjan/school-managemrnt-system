"use client";

import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { computeCommPulse } from "@/lib/selectors/communication-pulse";
import { roleLabels } from "@/lib/permissions/roles";
import { channelLabels, type CommChannel } from "@/lib/types/communication";
import { downloadTextFile } from "@/lib/utils";

export default function CommunicationAnalyticsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("comm.viewAnalytics")) return <PermissionDenied action="view communication analytics" role={roleLabels[role]} backHref="/communication" />;

  const pulse = computeCommPulse(db);
  const totalSent = db.commBroadcasts.reduce((s, b) => s + b.deliveredCount, 0) + db.commAnnouncements.reduce((s, a) => s + a.sentCount, 0);
  const open = db.conversations.filter((c) => c.status === "open");
  const responded = open.filter((c) => c.unreadCount === 0).length;
  const responseRate = open.length ? Math.round((responded / open.length) * 100) : 100;
  const resolvedTickets = db.helpdeskTickets.filter((t) => t.status === "resolved" || t.status === "closed").length;
  const resolutionRate = db.helpdeskTickets.length ? Math.round((resolvedTickets / db.helpdeskTickets.length) * 100) : 0;

  // Channel usage across announcements + broadcasts.
  const channelCount = new Map<CommChannel, number>();
  for (const a of db.commAnnouncements) for (const ch of a.channels) channelCount.set(ch, (channelCount.get(ch) ?? 0) + 1);
  for (const b of db.commBroadcasts) for (const ch of b.channels) channelCount.set(ch, (channelCount.get(ch) ?? 0) + 1);
  const maxChannel = Math.max(1, ...channelCount.values());

  // Communication by module (conversation categories).
  const byCategory = new Map<string, number>();
  for (const c of db.conversations) byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1);
  const maxCat = Math.max(1, ...byCategory.values());

  function exportSummary() {
    const lines = ["Metric,Value", `Messages sent (approx),${totalSent}`, `Response rate,${responseRate}%`, `Open conversations,${open.length}`, `Tickets,${db.helpdeskTickets.length}`, `Ticket resolution,${resolutionRate}%`];
    downloadTextFile("communication-analytics.csv", lines.join("\n"));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Communication analytics</h1>
          <p className="text-xs text-muted-foreground">Aggregate reach & responsiveness — no per-person surveillance</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportSummary}><Download className="size-3.5" /> Export</Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Messages sent" value={totalSent.toLocaleString("en-IN")} tone="neutral" />
        <StatTile label="Response rate" value={`${responseRate}%`} tone={responseRate >= 80 ? "success" : "warning"} />
        <StatTile label="Comm health" value={String(pulse.score)} tone={pulse.score >= 80 ? "success" : "warning"} />
        <StatTile label="Ticket resolution" value={`${resolutionRate}%`} tone={resolutionRate >= 70 ? "success" : "warning"} />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Channel usage</h2>
          <div className="flex flex-col gap-sm">
            {(Object.keys(channelLabels) as CommChannel[]).map((ch) => (
              <div key={ch} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm"><span className="text-foreground">{channelLabels[ch]}{ch !== "in-app" && <span className="ml-1 text-xs text-muted-foreground">(demo)</span>}</span><span className="text-muted-foreground">{channelCount.get(ch) ?? 0}</span></div>
                <MiniBar percent={((channelCount.get(ch) ?? 0) / maxChannel) * 100} toneClassName={ch === "in-app" ? "bg-success" : "bg-primary"} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Communication by topic</h2>
          <div className="flex flex-col gap-sm">
            {[...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <div key={cat} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm"><span className="capitalize text-foreground">{cat.replace("-", " ")}</span><Badge tone="neutral">{count}</Badge></div>
                <MiniBar percent={(count / maxCat) * 100} toneClassName="bg-info" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
