"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, DoorOpen, ListFilter, Sparkles, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ConflictSummary } from "@/lib/selectors/timetable-conflicts";
import type { TimetableConflict, TimetableConflictType } from "@/lib/types/timetable";
import { cn } from "@/lib/utils";

const typeLabels: Record<TimetableConflictType, string> = {
  "teacher-double-booking": "Teacher overlap",
  "room-double-booking": "Room conflict",
  "subject-period-limit": "Subject limit",
  "consecutive-period-limit": "Scheduling issue",
};

export function ConflictSummaryBar({
  conflicts,
  summary,
  autoResolvableCount,
  dismissedStaleCount,
  activeTypeFilter,
  onTypeFilterChange,
  selectedConflictId,
  onSelectConflict,
  onAutoResolve,
  onDismissResolved,
  canManage,
}: {
  conflicts: TimetableConflict[];
  summary: ConflictSummary;
  autoResolvableCount: number;
  dismissedStaleCount: number;
  activeTypeFilter: TimetableConflictType | null;
  onTypeFilterChange: (type: TimetableConflictType | null) => void;
  selectedConflictId: string | null;
  onSelectConflict: (conflict: TimetableConflict) => void;
  onAutoResolve: () => void;
  onDismissResolved: () => void;
  canManage: boolean;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);

  if (summary.total === 0) {
    return (
      <div className="flex items-center gap-sm rounded-lg border border-success/25 bg-success/8 px-sm py-sm text-sm text-success">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">No conflicts detected</span>
        <span className="text-xs text-success/80">This timetable is clear.</span>
      </div>
    );
  }

  const filtered = activeTypeFilter ? conflicts.filter((c) => c.type === activeTypeFilter) : conflicts;

  return (
    <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-sm px-sm py-sm">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-error/12 text-error">
          <AlertTriangle className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{summary.total} conflict{summary.total === 1 ? "" : "s"} detected</p>
          <p className="text-xs text-muted-foreground">
            {summary.teacherOverlaps} teacher overlap{summary.teacherOverlaps === 1 ? "" : "s"} · {summary.roomConflicts} room conflict{summary.roomConflicts === 1 ? "" : "s"} · {summary.schedulingIssues} scheduling issue{summary.schedulingIssues === 1 ? "" : "s"}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-xs">
          <Button size="sm" variant="outline" onClick={() => setReviewOpen((v) => !v)} aria-expanded={reviewOpen}>
            Review conflicts
            <ChevronDown className={cn("size-3.5 transition-transform", reviewOpen && "rotate-180")} aria-hidden="true" />
          </Button>
          {canManage && autoResolvableCount > 0 && (
            <Button size="sm" variant="outline" onClick={onAutoResolve}>
              <Sparkles className="size-3.5" />
              Auto-resolve safe ({autoResolvableCount})
            </Button>
          )}
          {canManage && dismissedStaleCount > 0 && (
            <Button size="sm" variant="ghost" onClick={onDismissResolved}>
              <Trash2 className="size-3.5" />
              Dismiss resolved ({dismissedStaleCount})
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <ListFilter className="size-3.5" />
                {activeTypeFilter ? typeLabels[activeTypeFilter] : "All types"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by conflict type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onTypeFilterChange(null)}>All types</DropdownMenuItem>
              {(Object.keys(typeLabels) as TimetableConflictType[]).map((type) => (
                <DropdownMenuItem key={type} onSelect={() => onTypeFilterChange(type)}>
                  {typeLabels[type]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {reviewOpen && (
        <ul className="flex flex-col gap-1 border-t border-border px-sm pb-sm pt-sm">
          {filtered.map((conflict) => (
            <li key={conflict.id}>
              <button
                type="button"
                onClick={() => onSelectConflict(conflict)}
                className={cn(
                  "flex w-full items-center gap-sm rounded-md border px-sm py-sm text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  selectedConflictId === conflict.id ? "border-error bg-error/8" : "border-border bg-surface hover:bg-surface-secondary/60",
                )}
              >
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-pill", conflict.severity === "error" ? "bg-error/12 text-error" : "bg-warning/12 text-warning")}>
                  {conflict.type === "teacher-double-booking" ? <Users className="size-3" /> : conflict.type === "room-double-booking" ? <DoorOpen className="size-3" /> : <AlertTriangle className="size-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{conflict.description}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {conflict.day} · Period {conflict.periodIndex}
                  </span>
                </span>
                <Badge tone={conflict.severity === "error" ? "error" : "warning"}>{typeLabels[conflict.type]}</Badge>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <p className="py-sm text-center text-xs text-muted-foreground">No conflicts match this filter.</p>}
        </ul>
      )}
    </div>
  );
}
