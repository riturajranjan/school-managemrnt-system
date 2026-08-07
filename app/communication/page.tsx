"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarClock,
  FileText,
  Gauge,
  Inbox,
  LayoutList,
  LifeBuoy,
  Megaphone,
  MessageSquarePlus,
  Radio,
  Siren,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PulseGauge } from "@/components/dashboard/pulse-gauge";
import { toneClasses } from "@/components/dashboard/tone";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useShell } from "@/components/shell/shell-context";
import { useSisStore } from "@/lib/hooks/use-store";
import { commActionItems, commSummary } from "@/lib/selectors/communication-brief";
import { computeCommPulse } from "@/lib/selectors/communication-pulse";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

const quickLinks = [
  { href: "/communication/inbox", label: "Unified inbox", icon: Inbox },
  { href: "/communication/parents", label: "Parent–Teacher", icon: Users },
  { href: "/communication/announcements", label: "Announcements", icon: Megaphone },
  { href: "/communication/notices", label: "Notice board", icon: FileText },
  { href: "/communication/broadcasts", label: "Broadcasts", icon: Radio },
  { href: "/communication/templates", label: "Templates", icon: FileText },
  { href: "/communication/calendar", label: "Calendar", icon: CalendarClock },
  { href: "/communication/emergency", label: "Emergency", icon: Siren },
  { href: "/notifications", label: "Notifications", icon: BellRing },
  { href: "/helpdesk", label: "Helpdesk", icon: LifeBuoy },
];

export default function CommunicationCommandCentre() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const { activeSession } = useShell();
  const [pulseOpen, setPulseOpen] = useState(false);

  if (!can("comm.view")) return <PermissionDenied action="view the communication hub" role={roleLabels[role]} backHref="/" />;

  const today = new Date().toISOString().slice(0, 10);
  const summary = commSummary(db);
  const actions = commActionItems(db);
  const pulse = computeCommPulse(db);
  const sorted = [...pulse.factors].sort((a, b) => a.score - b.score);
  const canManage = can("comm.manageAnnouncements");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Communication Command Centre</h1>
          <p className="text-xs text-muted-foreground">School-wide messaging, announcements & support · {activeSession} · {formatDate(today)}</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <Button asChild size="sm"><Link href="/communication/inbox"><MessageSquarePlus className="size-3.5" /> New message</Link></Button>
          {canManage && <Button asChild size="sm" variant="outline"><Link href="/communication/announcements"><Megaphone className="size-3.5" /> Announcement</Link></Button>}
          {can("comm.broadcast") && <Button asChild size="sm" variant="outline"><Link href="/communication/broadcasts"><Radio className="size-3.5" /> Broadcast</Link></Button>}
          {can("comm.emergency") && <Button asChild size="sm" variant="outline"><Link href="/communication/emergency"><Siren className="size-3.5" /> Emergency</Link></Button>}
        </div>
      </div>

      <section aria-label="Communication summary" className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Unread" value={String(summary.unread)} icon={Inbox} tone={summary.unread > 0 ? "info" : "neutral"} />
        <StatTile label="Priority" value={String(summary.priority)} icon={AlertTriangle} tone={summary.priority > 0 ? "warning" : "success"} />
        <StatTile label="Parent messages" value={String(summary.parentMessages)} icon={Users} tone="neutral" />
        <StatTile label="Staff messages" value={String(summary.staffMessages)} icon={Users} tone="neutral" />
        <StatTile label="Scheduled" value={String(summary.scheduledAnnouncements)} icon={CalendarClock} tone="info" />
        <StatTile label="Awaiting ack" value={String(summary.noticesAwaitingAck)} icon={FileText} tone={summary.noticesAwaitingAck > 0 ? "warning" : "success"} />
        <StatTile label="Open tickets" value={String(summary.openTickets)} icon={LifeBuoy} tone={summary.openTickets > 0 ? "warning" : "success"} />
        <StatTile label="Urgent tickets" value={String(summary.urgentTickets)} icon={AlertTriangle} tone={summary.urgentTickets > 0 ? "error" : "success"} />
        <StatTile label="Visitors today" value={String(summary.visitorsToday)} icon={Users} tone="neutral" />
        <StatTile label="Appointments" value={String(summary.appointmentsToday)} icon={CalendarClock} tone="neutral" />
      </section>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">What requires action now</h2>
              <Badge tone={actions.length === 0 ? "success" : "warning"}>{actions.length} item(s)</Badge>
            </div>
            {actions.length === 0 ? (
              <p className="py-md text-center text-sm text-muted-foreground">All caught up. Nothing needs attention right now.</p>
            ) : (
              <ul className="flex flex-col gap-sm">
                {actions.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm transition-colors hover:border-primary/40">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`size-1.5 shrink-0 rounded-pill ${toneClasses[item.tone].dot}`} aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                      </div>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-5">
            {quickLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="surface-3d flex flex-col items-center gap-1 rounded-lg border border-border bg-surface p-sm text-center outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" /></span>
                <span className="text-xs font-medium text-foreground">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><Gauge className="size-4" /> Communication Pulse</h2>
            <button type="button" onClick={() => setPulseOpen(true)} className="flex items-center gap-1 text-xs font-medium text-primary"><LayoutList className="size-3.5" /> Breakdown</button>
          </div>
          <div className="flex flex-col items-center gap-sm">
            {/* Layered signal rings behind the gauge for a subtle communication treatment */}
            <div className="relative">
              <span className="pointer-events-none absolute inset-0 -z-0 rounded-full ring-1 ring-primary/10" style={{ transform: "scale(1.25)" }} aria-hidden="true" />
              <span className="pointer-events-none absolute inset-0 -z-0 rounded-full ring-1 ring-primary/5" style={{ transform: "scale(1.5)" }} aria-hidden="true" />
              <PulseGauge score={pulse.score} factors={pulse.factors} />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Strongest: <span className="font-medium text-foreground">{sorted[sorted.length - 1].label}</span> · Main issue: <span className="font-medium text-foreground">{sorted[0].label}</span>
            </p>
            <p className="text-center text-xs text-muted-foreground">Recommended: <span className="font-medium text-foreground">Improve {sorted[0].label.toLowerCase()}</span></p>
          </div>
        </div>
      </div>

      <DetailDrawer open={pulseOpen} onOpenChange={setPulseOpen} title="Communication Pulse breakdown" description="All factors contributing to the composite score">
        <div className="flex flex-col gap-md">
          {pulse.factors.map((factor) => (
            <div key={factor.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{factor.label}</span>
                <span className={toneClasses[factor.tone].text}>{factor.displayValue}</span>
              </div>
              <MiniBar percent={factor.score} toneClassName={toneClasses[factor.tone].dot} />
            </div>
          ))}
        </div>
      </DetailDrawer>
    </div>
  );
}
