"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { interviewTypeLabels } from "@/lib/types/hr";
import { formatDate } from "@/lib/utils";

export default function InterviewsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [view, setView] = useState<"list" | "calendar">("list");
  if (!can("hr.view") && !can("hr.manageRecruitment")) return <PermissionDenied action="view interviews" role={roleLabels[role]} backHref="/hr/recruitment" />;

  const candName = (id: string) => { const c = db.candidates.find((x) => x.id === id); return c ? `${c.firstName} ${c.lastName}` : "—"; };
  const sorted = [...db.interviews].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  // Group by date for calendar-ish view.
  const byDate = new Map<string, typeof sorted>();
  for (const i of sorted) { const l = byDate.get(i.date) ?? []; l.push(i); byDate.set(i.date, l); }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Interviews</h1>
          <p className="text-xs text-muted-foreground">{db.interviews.length} scheduled interviews</p>
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          <button onClick={() => setView("list")} className={`flex items-center gap-1 rounded px-sm py-1.5 text-xs font-medium ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><List className="size-3.5" /> List</button>
          <button onClick={() => setView("calendar")} className={`flex items-center gap-1 rounded px-sm py-1.5 text-xs font-medium ${view === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><CalendarClock className="size-3.5" /> By day</button>
        </div>
      </div>

      {db.interviews.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <CalendarClock className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No interviews scheduled.</p>
        </div>
      ) : view === "list" ? (
        <div className="flex flex-col gap-sm">
          {sorted.map((i) => (
            <Link key={i.id} href={`/hr/recruitment/candidates/${i.candidateId}`} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm hover:border-primary/40">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{candName(i.candidateId)}</p>
                <p className="truncate text-xs text-muted-foreground">{interviewTypeLabels[i.type]} · {formatDate(i.date)} {i.time} · {i.location}</p>
              </div>
              <Badge tone={i.status === "completed" ? "success" : i.status === "cancelled" ? "neutral" : "info"}>{i.status}</Badge>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {[...byDate.entries()].map(([date, list]) => (
            <div key={date}>
              <p className="mb-xs text-sm font-semibold text-foreground">{formatDate(date)}</p>
              <div className="flex flex-col gap-xs">
                {list.map((i) => (
                  <Link key={i.id} href={`/hr/recruitment/candidates/${i.candidateId}`} className="flex items-center gap-sm rounded-md border border-border bg-surface p-sm hover:border-primary/40">
                    <span className="w-14 shrink-0 text-xs font-medium text-primary">{i.time}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{candName(i.candidateId)} · {interviewTypeLabels[i.type]}</span>
                    <Badge tone={i.status === "completed" ? "success" : "info"}>{i.status}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
