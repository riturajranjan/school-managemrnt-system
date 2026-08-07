"use client";

import { useState } from "react";
import { Bell, CalendarDays, LayoutGrid, ListTree, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { announcementStatusTone, noticeCategoryLabels, type Notice } from "@/lib/types/communication";
import { formatDate } from "@/lib/utils";

type View = "cards" | "timeline" | "calendar";

export default function NoticeBoardPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [view, setView] = useState<View>("cards");
  const [flash, setFlash] = useState<string | null>(null);

  if (!can("comm.view") && !can("comm.viewOwn")) return <PermissionDenied action="view the notice board" role={roleLabels[role]} backHref="/communication" />;
  const canManage = can("comm.manageAnnouncements");
  const notices = [...db.commNotices].sort((a, b) => b.publishAt.localeCompare(a.publishAt));

  function remind(n: Notice) {
    setFlash(`Reminder queued for ${n.sentCount - n.acknowledgedCount} pending recipient(s) of "${n.title}".`);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Notice board</h1>
          <p className="text-xs text-muted-foreground">{notices.length} notices</p>
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {([["cards", LayoutGrid], ["timeline", ListTree], ["calendar", CalendarDays]] as const).map(([v, Icon]) => (
            <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1 rounded px-sm py-1.5 text-xs font-medium capitalize ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><Icon className="size-3.5" /> {v}</button>
          ))}
        </div>
      </div>

      {flash && <div className="rounded-md border border-success/30 bg-success/8 p-sm text-sm text-success" role="status">{flash}</div>}

      {view === "cards" && (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {notices.map((n) => <NoticeCard key={n.id} notice={n} canManage={canManage} onRemind={() => remind(n)} />)}
        </div>
      )}

      {view === "timeline" && (
        <ol className="relative flex flex-col gap-md border-l border-border pl-md">
          {notices.map((n) => (
            <li key={n.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 size-2 rounded-pill bg-primary" aria-hidden="true" />
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                <Badge tone={n.colorTone}>{noticeCategoryLabels[n.category]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(n.publishAt)} · {n.body}</p>
            </li>
          ))}
        </ol>
      )}

      {view === "calendar" && (
        <div className="flex flex-col gap-sm">
          {Object.entries(notices.reduce((acc, n) => { const d = n.publishAt.slice(0, 10); (acc[d] ??= []).push(n); return acc; }, {} as Record<string, Notice[]>)).sort((a, b) => b[0].localeCompare(a[0])).map(([date, list]) => (
            <div key={date}>
              <p className="mb-xs text-sm font-semibold text-foreground">{formatDate(date)}</p>
              <div className="flex flex-col gap-xs">
                {list.map((n) => (
                  <div key={n.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm">
                    <span className="min-w-0 truncate text-sm text-foreground">{n.title}</span>
                    <Badge tone={n.colorTone}>{noticeCategoryLabels[n.category]}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NoticeCard({ notice, canManage, onRemind }: { notice: Notice; canManage: boolean; onRemind: () => void }) {
  const seenPct = notice.sentCount > 0 ? Math.round((notice.seenCount / notice.sentCount) * 100) : 0;
  const ackPct = notice.sentCount > 0 ? Math.round((notice.acknowledgedCount / notice.sentCount) * 100) : 0;
  const pending = notice.sentCount - notice.acknowledgedCount;
  return (
    <div className="surface-3d flex flex-col gap-sm rounded-lg border-l-4 border-border bg-surface p-md" style={{ borderLeftColor: "var(--color-primary)" }}>
      <div className="flex items-start justify-between gap-sm">
        <div className="flex items-center gap-2">
          <Pin className="size-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{notice.title}</p>
            <p className="text-xs text-muted-foreground">{noticeCategoryLabels[notice.category]} · {formatDate(notice.publishAt)}</p>
          </div>
        </div>
        <Badge tone={announcementStatusTone[notice.status]}>{notice.status}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{notice.body}</p>
      {notice.status === "published" && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Seen {seenPct}%</span><span>{notice.acknowledgementRequired ? `Acknowledged ${ackPct}%` : "No ack required"}</span></div>
          <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-secondary"><div className="h-full rounded-pill bg-primary" style={{ width: `${notice.acknowledgementRequired ? ackPct : seenPct}%` }} /></div>
        </div>
      )}
      {canManage && notice.acknowledgementRequired && pending > 0 && (
        <Button size="sm" variant="outline" onClick={onRemind}><Bell className="size-3.5" /> Remind {pending} pending</Button>
      )}
    </div>
  );
}
