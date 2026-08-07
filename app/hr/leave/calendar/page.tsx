"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { hrLeaveTypeLabels } from "@/lib/types/hr";

export default function LeaveCalendarPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [monthOffset, setMonthOffset] = useState(0);

  if (!can("hr.view")) return <PermissionDenied action="view the leave calendar" role={roleLabels[role]} backHref="/hr/leave" />;

  const base = new Date();
  base.setMonth(base.getMonth() + monthOffset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const monthLabel = base.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const approved = db.hrLeaveRequests.filter((r) => r.status === "approved");
  const empName = (id: string) => { const e = db.employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };

  function leavesOn(day: number): { name: string; type: string }[] {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return approved.filter((r) => r.startDate <= iso && r.endDate >= iso).map((r) => ({ name: empName(r.employeeId), type: hrLeaveTypeLabels[r.leaveType] }));
  }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/hr/leave"><ArrowLeft className="size-4" /></Link></Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Leave calendar</h1>
          <p className="text-xs text-muted-foreground">Approved leave across the team</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button size="icon" variant="outline" onClick={() => setMonthOffset((m) => m - 1)} aria-label="Previous month"><ChevronLeft className="size-4" /></Button>
        <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
        <Button size="icon" variant="outline" onClick={() => setMonthOffset((m) => m + 1)} aria-label="Next month"><ChevronRight className="size-4" /></Button>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="p-1 text-center text-xs font-semibold text-muted-foreground">{d}</div>
          ))}
          {cells.map((day, i) => {
            const leaves = day ? leavesOn(day) : [];
            return (
              <div key={i} className={`min-h-16 rounded-md border p-1 ${day ? "border-border bg-surface" : "border-transparent"}`}>
                {day && (
                  <>
                    <span className="text-xs font-medium text-muted-foreground">{day}</span>
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {leaves.slice(0, 2).map((l, j) => (
                        <span key={j} className="truncate rounded-sm bg-primary/10 px-1 text-[10px] text-primary" title={`${l.name} · ${l.type}`}>{l.name.split(" ")[0]}</span>
                      ))}
                      {leaves.length > 2 && <span className="text-[10px] text-muted-foreground">+{leaves.length - 2} more</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
