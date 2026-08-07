"use client";

import Link from "next/link";
import { AlertTriangle, BookOpen, CheckCircle2, Clock, Inbox, LayoutList, LifeBuoy, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { ticketCategoryLabels, ticketPriorityTone, ticketStatusLabels, ticketStatusTone, type TicketCategory } from "@/lib/types/communication";
import { timeAgo } from "@/lib/utils";

export default function HelpdeskCommandCentre() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("helpdesk.view") && !can("helpdesk.viewOwn")) return <PermissionDenied action="view the helpdesk" role={roleLabels[role]} backHref="/" />;

  const today = new Date().toISOString().slice(0, 10);
  const t = db.helpdeskTickets;
  const open = t.filter((x) => x.status !== "resolved" && x.status !== "closed");
  const newToday = t.filter((x) => x.createdAt.slice(0, 10) === today).length;
  const urgent = open.filter((x) => x.priority === "urgent").length;
  const awaiting = t.filter((x) => x.status === "waiting-on-requester").length;
  const resolvedToday = t.filter((x) => (x.status === "resolved" || x.status === "closed") && x.lastActivityAt.slice(0, 10) === today).length;
  const slaRisk = open.filter((x) => x.slaHours <= 8 && (x.priority === "high" || x.priority === "urgent")).length;

  // By category
  const byCat = new Map<TicketCategory, number>();
  for (const x of open) byCat.set(x.category, (byCat.get(x.category) ?? 0) + 1);

  const recent = [...open].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)).slice(0, 6);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Helpdesk</h1>
          <p className="text-xs text-muted-foreground">Internal school support tickets</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/helpdesk/knowledge-base"><BookOpen className="size-3.5" /> Knowledge base</Link></Button>
          <Button asChild size="sm"><Link href="/helpdesk/tickets"><LayoutList className="size-3.5" /> All tickets</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Open" value={String(open.length)} icon={Inbox} tone={open.length > 0 ? "info" : "success"} />
        <StatTile label="New today" value={String(newToday)} icon={LifeBuoy} tone="neutral" />
        <StatTile label="Urgent" value={String(urgent)} icon={AlertTriangle} tone={urgent > 0 ? "error" : "success"} />
        <StatTile label="Awaiting" value={String(awaiting)} icon={Clock} tone="warning" />
        <StatTile label="Resolved today" value={String(resolvedToday)} icon={CheckCircle2} tone="success" />
        <StatTile label="SLA risk" value={String(slaRisk)} icon={Timer} tone={slaRisk > 0 ? "warning" : "success"} />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Recent activity</h2>
          <div className="flex flex-col gap-xs">
            {recent.map((x) => (
              <Link key={x.id} href={`/helpdesk/tickets/${x.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm hover:border-primary/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{x.subject}</p>
                  <p className="text-xs text-muted-foreground">{x.reference} · {x.requesterName} · {timeAgo(x.lastActivityAt)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge tone={ticketPriorityTone[x.priority]}>{x.priority}</Badge>
                  <Badge tone={ticketStatusTone[x.status]}>{ticketStatusLabels[x.status]}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Open by category</h2>
          <div className="flex flex-col gap-xs">
            {[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <Link key={cat} href="/helpdesk/tickets" className="flex items-center justify-between gap-sm rounded-md border border-border p-sm hover:border-primary/40">
                <span className="text-sm text-foreground">{ticketCategoryLabels[cat]}</span>
                <Badge tone="neutral">{count}</Badge>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
