"use client";

import { useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setComplaintStatus } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { complaintCategoryLabels, complaintStatusTone, type ComplaintStatus } from "@/lib/types/hostel";
import { timeAgo } from "@/lib/utils";

export default function HostelComplaintsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  if (!can("hostel.view")) return <PermissionDenied action="view hostel complaints" role={roleLabels[role]} backHref="/hostel" />;
  const canManage = can("hostel.complaints") || can("hostel.manage");
  const student = (id: string) => db.students.find((s) => s.id === id);
  const room = (id: string) => db.hostelRooms.find((r) => r.id === id);
  const rows = [...db.hostelComplaints].sort((a, b) => Number(a.status === "closed" || a.status === "resolved") - Number(b.status === "closed" || b.status === "resolved") || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Hostel complaints</h1><p className="text-xs text-muted-foreground">{db.hostelComplaints.filter((c) => c.status !== "resolved" && c.status !== "closed").length} open · shares Helpdesk patterns</p></div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><MessageSquareWarning className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No complaints.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((c) => { const s = student(c.studentId); return (
            <div key={c.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{c.reference} · {complaintCategoryLabels[c.category]}</p><p className="truncate text-xs text-muted-foreground">{c.description}</p><p className="text-xs text-muted-foreground">{s?.profile.firstName} · Room {room(c.roomId)?.roomNumber} · {c.assignedTeam} · {timeAgo(c.createdAt)}</p></div>
              <div className="flex shrink-0 items-center gap-xs">
                <Badge tone={c.priority === "urgent" ? "error" : c.priority === "high" ? "warning" : "neutral"}>{c.priority}</Badge>
                {canManage ? <Select value={c.status} onValueChange={(v) => { setComplaintStatus(c.id, v as ComplaintStatus); force((n) => n + 1); }}><SelectTrigger className="w-32" aria-label="Status"><SelectValue /></SelectTrigger><SelectContent>{(["new", "assigned", "in-progress", "resolved", "closed"] as ComplaintStatus[]).map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select> : <Badge tone={complaintStatusTone[c.status]}>{c.status}</Badge>}
              </div>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
