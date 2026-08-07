"use client";

import { useState } from "react";
import { KanbanSquare, List, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setHostelMaintenanceStatus } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { complaintCategoryLabels, maintenanceStatusLabels, maintenanceStatusTone, type HostelMaintenance, type MaintenanceStatus } from "@/lib/types/hostel";
import { formatDate } from "@/lib/utils";

const columns: MaintenanceStatus[] = ["new", "assigned", "in-progress", "resolved", "closed"];

export default function HostelMaintenancePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [, force] = useState(0);
  if (!can("hostel.view")) return <PermissionDenied action="view hostel maintenance" role={roleLabels[role]} backHref="/hostel" />;
  const canManage = can("hostel.manage") || can("hostel.complaints");
  const room = (id: string) => db.hostelRooms.find((r) => r.id === id);

  function advance(m: HostelMaintenance) {
    const next = columns[Math.min(columns.indexOf(m.status) + 1, columns.length - 1)];
    setHostelMaintenanceStatus(m.id, next, m.assignedTo ?? "Facilities Team");
    force((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Maintenance board</h1><p className="text-xs text-muted-foreground">{db.hostelMaintenance.filter((m) => m.status !== "resolved" && m.status !== "closed").length} open</p></div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          <button onClick={() => setView("kanban")} className={`flex items-center gap-1 rounded px-sm py-1.5 text-xs font-medium ${view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><KanbanSquare className="size-3.5" /> Board</button>
          <button onClick={() => setView("list")} className={`flex items-center gap-1 rounded px-sm py-1.5 text-xs font-medium ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><List className="size-3.5" /> List</button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="flex gap-sm overflow-x-auto pb-2">
          {columns.map((col) => {
            const items = db.hostelMaintenance.filter((m) => m.status === col);
            return (
              <div key={col} className="flex w-64 shrink-0 flex-col gap-sm rounded-lg border border-border bg-surface-secondary/30 p-sm">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold text-foreground">{maintenanceStatusLabels[col]}</span><Badge tone={maintenanceStatusTone[col]}>{items.length}</Badge></div>
                {items.map((m) => (
                  <div key={m.id} className="rounded-md border border-border bg-surface p-sm">
                    <p className="text-sm font-medium text-foreground">{m.issue}</p>
                    <p className="text-xs text-muted-foreground">Room {room(m.roomId)?.roomNumber} · {complaintCategoryLabels[m.category]}</p>
                    <div className="mt-1 flex items-center justify-between"><Badge tone={m.priority === "urgent" ? "error" : "neutral"}>{m.priority}</Badge>{canManage && col !== "closed" && <Button size="sm" variant="ghost" onClick={() => advance(m)}>Advance</Button>}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {db.hostelMaintenance.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{m.issue}</p><p className="text-xs text-muted-foreground">Room {room(m.roomId)?.roomNumber} · {m.assignedTo ?? "Unassigned"}{m.eta ? ` · ETA ${formatDate(m.eta)}` : ""}</p></div>
              <Badge tone={maintenanceStatusTone[m.status]}>{maintenanceStatusLabels[m.status]}</Badge>
            </div>
          ))}
        </div>
      )}
      {db.hostelMaintenance.length === 0 && <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-xl text-center"><Wrench className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No maintenance requests.</p></div>}
    </div>
  );
}
