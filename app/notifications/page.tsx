"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Bell, BellOff, CalendarDays, CheckCheck, ClipboardCheck, FileBadge, UserCheck, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotificationList, markAllNotificationsReadRequest, markNotificationReadRequest } from "@/lib/hooks/api/use-notifications-api";
import type { NotificationDto, NotificationTypeDto } from "@/lib/api/contracts";
import { timeAgo } from "@/lib/utils";

const TYPE_ICON: Record<NotificationTypeDto, LucideIcon> = {
  "lesson-plan-approved": ClipboardCheck,
  "lesson-plan-rejected": ClipboardCheck,
  "exam-scheduled": FileBadge,
  "calendar-event": CalendarDays,
  "leave-request-submitted": UserCheck,
  "leave-request-approved": UserCheck,
  "leave-request-rejected": UserCheck,
};
const TYPE_LABEL: Record<NotificationTypeDto, string> = {
  "lesson-plan-approved": "Lesson plans",
  "lesson-plan-rejected": "Lesson plans",
  "exam-scheduled": "Exams",
  "calendar-event": "Calendar",
  "leave-request-submitted": "Leave",
  "leave-request-approved": "Leave",
  "leave-request-rejected": "Leave",
};

function dayBucket(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  return h < 24 ? "Today" : h < 48 ? "Yesterday" : "Earlier";
}

export default function NotificationCentrePage() {
  const { data: notifications, loading, reload } = useNotificationList();

  const unread = notifications.filter((n) => !n.readAt).length;

  // Group by relative day bucket.
  const grouped = useMemo(() => {
    const acc: Record<string, NotificationDto[]> = {};
    for (const n of notifications) (acc[dayBucket(n.createdAt)] ??= []).push(n);
    return acc;
  }, [notifications]);
  const order = ["Today", "Yesterday", "Earlier"];

  async function handleMarkAllRead() {
    await markAllNotificationsReadRequest();
    reload();
  }
  async function handleMarkRead(id: string) {
    await markNotificationReadRequest(id);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Notifications</h1>
          <p className="text-xs text-muted-foreground">{unread} unread</p>
        </div>
        <div className="flex gap-xs">
          <Button size="sm" variant="outline" onClick={handleMarkAllRead} disabled={unread === 0}>
            <CheckCheck className="size-3.5" /> Mark all read
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <BellOff className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No notifications here.</p>
        </div>
      ) : (
        order.filter((b) => grouped[b]?.length).map((b) => (
          <section key={b}>
            <h2 className="mb-xs text-xs font-semibold uppercase tracking-wide text-muted-foreground">{b}</h2>
            <div className="flex flex-col gap-xs">
              {grouped[b].map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                const read = Boolean(n.readAt);
                return (
                  <div key={n.id} className={`flex items-start gap-sm rounded-lg border p-sm ${read ? "border-border bg-surface" : "border-primary/30 bg-primary/5"}`}>
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${read ? "font-medium" : "font-semibold"} text-foreground`}>{n.title}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{n.body}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge tone="neutral">{TYPE_LABEL[n.type]}</Badge>
                        {n.href && (
                          <Link href={n.href} onClick={() => handleMarkRead(n.id)} className="text-xs font-medium text-primary">
                            Open →
                          </Link>
                        )}
                        {!read && (
                          <button onClick={() => handleMarkRead(n.id)} className="text-xs text-muted-foreground hover:text-foreground">
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
