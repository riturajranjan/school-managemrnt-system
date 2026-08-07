"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, Bell, BellOff, CheckCheck, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { archiveNotification, markAllNotificationsRead, markNotificationRead } from "@/lib/services/communication-service";
import { roleLabels } from "@/lib/permissions/roles";
import { notificationModuleLabels, type NotificationModule } from "@/lib/types/communication";
import { timeAgo } from "@/lib/utils";

export default function NotificationCentrePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [module, setModule] = useState<string>("all");
  const [, force] = useState(0);

  if (!can("comm.viewOwn") && !can("comm.view")) return <PermissionDenied action="view notifications" role={roleLabels[role]} backHref="/" />;

  const all = db.commNotifications.filter((n) => !n.archived).filter((n) => (module === "all" ? true : n.module === module));
  const unread = all.filter((n) => !n.read).length;
  const modulesInUse = [...new Set(db.commNotifications.map((n) => n.module))];

  // Group by relative day bucket.
  const now = new Date().getTime();
  const bucket = (iso: string) => { const h = (now - new Date(iso).getTime()) / 3_600_000; return h < 24 ? "Today" : h < 48 ? "Yesterday" : "Earlier"; };
  const grouped = all.reduce((acc, n) => { (acc[bucket(n.createdAt)] ??= []).push(n); return acc; }, {} as Record<string, typeof all>);
  const order = ["Today", "Yesterday", "Earlier"];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Notifications</h1>
          <p className="text-xs text-muted-foreground">{unread} unread</p>
        </div>
        <div className="flex gap-xs">
          <Button size="sm" variant="outline" onClick={() => { markAllNotificationsRead(); force((n) => n + 1); }}><CheckCheck className="size-3.5" /> Mark all read</Button>
          <Button asChild size="sm" variant="ghost"><Link href="/notifications/preferences"><Settings2 className="size-3.5" /> Preferences</Link></Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        <button onClick={() => setModule("all")} className={`shrink-0 rounded-pill px-3 py-1 text-xs font-medium ${module === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>All</button>
        {modulesInUse.map((m) => (
          <button key={m} onClick={() => setModule(m)} className={`shrink-0 rounded-pill px-3 py-1 text-xs font-medium ${module === m ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{notificationModuleLabels[m as NotificationModule]}</button>
        ))}
      </div>

      {all.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <BellOff className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No notifications here.</p>
        </div>
      ) : (
        order.filter((b) => grouped[b]?.length).map((b) => (
          <section key={b}>
            <h2 className="mb-xs text-xs font-semibold uppercase tracking-wide text-muted-foreground">{b}</h2>
            <div className="flex flex-col gap-xs">
              {grouped[b].map((n) => (
                <div key={n.id} className={`flex items-start gap-sm rounded-lg border p-sm ${n.read ? "border-border bg-surface" : "border-primary/30 bg-primary/5"}`}>
                  <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ${n.priority === "urgent" ? "bg-error/10 text-error" : n.priority === "high" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}><Bell className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm ${n.read ? "font-medium" : "font-semibold"} text-foreground`}>{n.title}</p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{n.description}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone="neutral">{notificationModuleLabels[n.module]}</Badge>
                      {!n.read && <span className="sr-only">Unread</span>}
                      {n.ctaHref && <Link href={n.ctaHref} onClick={() => markNotificationRead(n.id)} className="text-xs font-medium text-primary">{n.ctaLabel ?? "Open"} →</Link>}
                      {!n.read && <button onClick={() => { markNotificationRead(n.id); force((x) => x + 1); }} className="text-xs text-muted-foreground hover:text-foreground">Mark read</button>}
                      <button onClick={() => { archiveNotification(n.id); force((x) => x + 1); }} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Archive"><Archive className="size-3" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
