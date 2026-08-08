"use client";

import { useState } from "react";
import { AlertTriangle, CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAcademicSessions } from "@/lib/hooks/use-admin";
import { setSessionStatus } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";
import { sessionStatusLabels, sessionStatusTone } from "@/lib/types/admin";
import { formatDate } from "@/lib/utils";

export default function AcademicSessionsPage() {
  const { role } = usePermissions();
  const sessions = useAcademicSessions();
  const [, force] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const canManage = role === "super-admin" || role === "administrator" || role === "principal";
  if (!canManage) return <PermissionDenied action="manage academic sessions" role={roleLabels[role]} backHref="/settings" />;

  const activate = (id: string) => { setSessionStatus(id, "active"); setConfirmId(null); force((n) => n + 1); };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><CalendarRange className="size-5 text-primary" /> Academic sessions</h1><p className="text-xs text-muted-foreground">{sessions.length} sessions · one active at a time</p></div>

      <div className="flex flex-col gap-sm">
        {sessions.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-surface p-md">
            <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
              <div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-foreground">{s.name}</p><Badge tone={sessionStatusTone[s.status]}>{sessionStatusLabels[s.status]}</Badge></div><p className="text-xs text-muted-foreground">{formatDate(s.startDate)} – {formatDate(s.endDate)} · Admissions from {formatDate(s.admissionStart)}</p></div>
              <div className="flex gap-xs">
                {s.status === "upcoming" && <Button size="sm" onClick={() => setConfirmId(s.id)}>Activate</Button>}
                {s.status === "active" && <Button size="sm" variant="outline" onClick={() => { setSessionStatus(s.id, "closed"); force((n) => n + 1); }}>Close</Button>}
                <Button size="sm" variant="ghost" disabled title="Copy configuration (simulation)">Copy config</Button>
              </div>
            </div>
            <div className="mt-sm grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3"><span>Exam period: <span className="text-foreground">{s.examPeriod}</span></span><span>Fee period: <span className="text-foreground">{s.feePeriod}</span></span></div>
            {confirmId === s.id && (
              <div className="mt-sm flex items-center justify-between gap-sm rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">
                <span className="flex items-center gap-1"><AlertTriangle className="size-4" /> Switching the active session affects every module. The current active session will be closed.</span>
                <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button><Button size="sm" onClick={() => activate(s.id)}>Confirm</Button></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
