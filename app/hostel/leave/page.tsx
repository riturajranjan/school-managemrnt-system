"use client";

import { useState } from "react";
import { CalendarDays, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setHostelLeaveStatus } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { hostelLeaveStatusLabels, hostelLeaveStatusTone, hostelLeaveTypeLabels } from "@/lib/types/hostel";
import { formatDate } from "@/lib/utils";

export default function HostelLeavePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [filter, setFilter] = useState<"pending" | "active" | "all">("pending");
  const [, force] = useState(0);
  if (!can("hostel.view")) return <PermissionDenied action="view hostel leave" role={roleLabels[role]} backHref="/hostel" />;
  const canManage = can("hostel.leave") || can("hostel.manage");

  const student = (id: string) => db.students.find((s) => s.id === id);
  const rows = db.hostelLeave.filter((l) => {
    if (filter === "pending") return l.status === "requested" || l.status === "parent-confirmed";
    if (filter === "active") return l.status === "active" || l.status === "approved" || l.status === "overdue";
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Hostel leave</h1><p className="text-xs text-muted-foreground">Home visits, day-outs and approvals</p></div>
        <div className="inline-flex rounded-md border border-border p-0.5">{(["pending", "active", "all"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded px-sm py-1.5 text-xs font-medium capitalize ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{f}</button>)}</div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><CalendarDays className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No leave in this view.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((l) => { const s = student(l.studentId); return (
            <div key={l.id} className="rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{s ? `${s.profile.firstName} ${s.profile.lastName}` : l.studentId}</p><p className="text-xs text-muted-foreground">{hostelLeaveTypeLabels[l.type]} · {formatDate(l.fromDate)} → {formatDate(l.toDate)} · {l.destination}</p><p className="text-xs text-muted-foreground">Guardian: {l.guardianName} · Pickup: {l.pickupPerson} · Return by {formatDate(l.expectedReturn)}</p></div>
                <Badge tone={hostelLeaveStatusTone[l.status]}>{hostelLeaveStatusLabels[l.status]}</Badge>
              </div>
              {/* Approval timeline */}
              <div className="mt-2 flex items-center gap-1 overflow-x-auto">
                {(["requested", "parent-confirmed", "approved", "active", "returned"] as const).map((stage, i) => {
                  const order = ["requested", "parent-confirmed", "approved", "active", "returned"];
                  const done = order.indexOf(l.status) >= i;
                  return <div key={stage} className="flex items-center gap-1"><span className={`flex size-5 items-center justify-center rounded-full text-[9px] font-bold ${done ? "bg-primary/15 text-primary" : "bg-surface-secondary text-muted-foreground"}`}>{i + 1}</span>{i < 4 && <span className={`h-0.5 w-4 rounded-pill ${done ? "bg-primary/40" : "bg-border"}`} />}</div>;
                })}
              </div>
              {canManage && (l.status === "requested" || l.status === "parent-confirmed") && (
                <div className="mt-2 flex gap-xs">
                  <Button size="sm" variant="outline" onClick={() => { setHostelLeaveStatus(l.id, "approved"); force((n) => n + 1); }}><Check className="size-3.5" /> Approve</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setHostelLeaveStatus(l.id, "rejected"); force((n) => n + 1); }}><X className="size-3.5" /> Reject</Button>
                </div>
              )}
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
