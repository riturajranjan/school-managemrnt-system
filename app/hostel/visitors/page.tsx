"use client";

import { useState } from "react";
import { Check, UsersRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setHostelVisitorStatus } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { hostelVisitorStatusLabels } from "@/lib/types/hostel";

const tone: Record<string, "success" | "warning" | "error" | "info" | "neutral"> = { expected: "info", waiting: "warning", approved: "info", "with-student": "success", departed: "neutral", denied: "error" };

export default function HostelVisitorsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  if (!can("hostel.view")) return <PermissionDenied action="view hostel visitors" role={roleLabels[role]} backHref="/hostel" />;
  const canManage = can("hostel.manage") || can("hostel.attendance");
  const student = (id: string) => db.students.find((s) => s.id === id);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Hostel visitors</h1><p className="text-xs text-muted-foreground">Visitor requests for residents · shares patterns with Front Desk</p></div>
      {db.hostelVisitors.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><UsersRound className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No visitors today.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {db.hostelVisitors.map((v) => { const s = student(v.studentId); return (
            <div key={v.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{v.visitorName} <span className="text-xs text-muted-foreground">({v.relation})</span></p><p className="truncate text-xs text-muted-foreground">For {s ? `${s.profile.firstName} ${s.profile.lastName}` : v.studentId} · {v.purpose}{v.arrivalTime ? ` · ${v.arrivalTime}` : ""}</p></div>
              <div className="flex shrink-0 items-center gap-xs">
                <Badge tone={tone[v.status]}>{hostelVisitorStatusLabels[v.status]}</Badge>
                {canManage && (v.status === "waiting" || v.status === "expected") && <><Button size="sm" variant="outline" onClick={() => { setHostelVisitorStatus(v.id, "approved"); force((n) => n + 1); }}><Check className="size-3.5" /></Button><Button size="sm" variant="ghost" onClick={() => { setHostelVisitorStatus(v.id, "denied"); force((n) => n + 1); }}><X className="size-3.5" /></Button></>}
                {canManage && v.status === "approved" && <Button size="sm" variant="outline" onClick={() => { setHostelVisitorStatus(v.id, "with-student"); force((n) => n + 1); }}>Meeting</Button>}
                {canManage && v.status === "with-student" && <Button size="sm" variant="ghost" onClick={() => { setHostelVisitorStatus(v.id, "departed"); force((n) => n + 1); }}>Depart</Button>}
              </div>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
