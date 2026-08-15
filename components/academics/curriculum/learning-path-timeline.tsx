"use client";

// Phase 9C.1 — real PostgreSQL/API cutover. Same timeline/drawer layout as
// before; "Notes" removed (no backing model — see prisma/schema.prisma's
// Curriculum doc comment). Reschedule edits real unit content (broad-manager
// only); Mark complete records real per-section topic progress (broad manager
// or the section's real TeachingAssignment holder) — both call the live API
// and let the parent refetch, no local optimistic mock state.
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeUnitForSectionRequest, updateUnitRequest } from "@/lib/hooks/api/use-curriculum-api";
import { useInView } from "@/lib/hooks/use-in-view";
import type { CurriculumAggregateStatusDto, CurriculumUnitDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const nodeFill: Record<CurriculumAggregateStatusDto, string> = {
  completed: "bg-success text-success-foreground",
  "in-progress": "bg-info text-info-foreground",
  "not-started": "bg-surface-secondary text-muted-foreground",
  delayed: "bg-error text-error-foreground",
};

const ringStroke: Record<CurriculumAggregateStatusDto, string> = {
  completed: "var(--color-success)",
  "in-progress": "var(--color-info)",
  "not-started": "var(--color-border)",
  delayed: "var(--color-error)",
};

const lineTone: Record<CurriculumAggregateStatusDto, string> = {
  completed: "bg-success",
  "in-progress": "bg-info",
  "not-started": "bg-border",
  delayed: "bg-error",
};

const statusLabel: Record<CurriculumAggregateStatusDto, string> = {
  completed: "Completed",
  "in-progress": "In progress",
  "not-started": "Not started",
  delayed: "Delayed",
};

function ProgressRing({ percent, status, selected, children }: { percent: number; status: CurriculumAggregateStatusDto; selected: boolean; children: React.ReactNode }) {
  const size = selected ? 52 : 44;
  const stroke = 3;
  const radius = size / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={stroke} opacity={0.4} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={ringStroke[status]} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      {children}
    </span>
  );
}

export function LearningPathTimeline({
  units, sectionId, canManageContent, canRecordProgress, onProgressChange,
}: {
  units: CurriculumUnitDto[];
  sectionId: string;
  canManageContent: boolean;
  canRecordProgress: boolean;
  onProgressChange: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [rStart, setRStart] = useState("");
  const [rEnd, setREnd] = useState("");
  const [busy, setBusy] = useState(false);
  const sorted = [...units].sort((a, b) => a.order - b.order);
  const selected = sorted.find((u) => u.id === selectedId) ?? null;

  if (sorted.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No curriculum units tracked yet.</p>;
  }

  function openUnit(unit: CurriculumUnitDto) {
    setSelectedId(unit.id);
    setRescheduling(false);
    setRStart(unit.plannedStart ?? "");
    setREnd(unit.plannedEnd ?? "");
  }

  async function markComplete(unitId: string) {
    setBusy(true);
    await completeUnitForSectionRequest(sectionId, unitId);
    setBusy(false);
    setSelectedId(null);
    onProgressChange();
  }

  async function saveReschedule(unitId: string) {
    setBusy(true);
    await updateUnitRequest(unitId, { plannedStart: rStart || undefined, plannedEnd: rEnd || undefined });
    setBusy(false);
    setRescheduling(false);
    onProgressChange();
  }

  return (
    <div ref={ref} className="flex flex-col gap-sm">
      <div className="scrollbar-none flex items-start gap-0 overflow-x-auto pb-sm pt-1">
        {sorted.map((unit, index) => {
          const percent = unit.totalTopics === 0 ? 0 : Math.min(100, Math.round((unit.completedTopics / unit.totalTopics) * 100));
          const isSelected = unit.id === selectedId;
          return (
            <div key={unit.id} className="flex shrink-0 items-center">
              {index > 0 && (
                <div className="relative h-1 w-6 shrink-0 sm:w-10" aria-hidden="true">
                  <div className={cn("absolute inset-x-0 top-0.5 h-1 rounded-full opacity-30", lineTone[sorted[index - 1].status])} />
                  <div className={cn("absolute inset-0 rounded-full", lineTone[sorted[index - 1].status])} />
                </div>
              )}
              <motion.button
                type="button"
                onClick={() => openUnit(unit)}
                initial={!reduceMotion && inView ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: isSelected && !reduceMotion ? -3 : 0 }}
                transition={{ duration: 0.25, delay: reduceMotion ? 0 : index * 0.04 }}
                aria-current={isSelected ? "true" : undefined}
                className={cn(
                  "flex w-28 shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-32",
                  isSelected && "bg-primary/5",
                )}
              >
                <ProgressRing percent={percent} status={unit.status} selected={isSelected}>
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-pill text-xs font-bold transition-shadow",
                      isSelected ? "size-9 shadow-[0_6px_14px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.3)] sm:size-11" : "size-8 shadow-card sm:size-10",
                      nodeFill[unit.status],
                    )}
                  >
                    {unit.order + 1}
                  </span>
                </ProgressRing>
                <span className="line-clamp-2 text-xs font-medium text-foreground">{unit.title}</span>
                <Badge tone={unit.status === "completed" ? "success" : unit.status === "delayed" ? "error" : unit.status === "in-progress" ? "info" : "neutral"} className="text-[10px]">
                  {statusLabel[unit.status]}
                </Badge>
              </motion.button>
            </div>
          );
        })}
      </div>

      <DetailDrawer open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)} title={selected?.title ?? ""} description={selected?.description ?? undefined}>
        {selected && (
          <div className="flex flex-col gap-md">
            <div className="grid grid-cols-2 gap-sm text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Planned</p>
                <p className="text-foreground">
                  {selected.plannedStart ? formatDate(selected.plannedStart) : "—"} – {selected.plannedEnd ? formatDate(selected.plannedEnd) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining topics</p>
                <p className="text-foreground">{Math.max(selected.totalTopics - selected.completedTopics, 0)} of {selected.totalTopics}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="text-foreground">{selected.totalTopics === 0 ? 0 : Math.round((selected.completedTopics / selected.totalTopics) * 100)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge tone={selected.status === "completed" ? "success" : selected.status === "delayed" ? "error" : selected.status === "in-progress" ? "info" : "neutral"}>{statusLabel[selected.status]}</Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-xs">
              {canManageContent && selected.status !== "completed" && (
                <Button size="sm" variant="outline" onClick={() => setRescheduling((v) => !v)}>
                  <CalendarClock className="size-3.5" />
                  Reschedule
                </Button>
              )}
              {canRecordProgress && selected.status !== "completed" && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => markComplete(selected.id)}>
                  <CheckCircle2 className="size-3.5" />
                  Mark complete
                </Button>
              )}
            </div>

            {rescheduling && (
              <div className="flex flex-col gap-sm rounded-md border border-border p-sm">
                <div className="grid grid-cols-2 gap-sm">
                  <div>
                    <Label htmlFor="reschedule-start">New planned start</Label>
                    <Input id="reschedule-start" type="date" value={rStart} onChange={(e) => setRStart(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="reschedule-end">New planned end</Label>
                    <Input id="reschedule-end" type="date" value={rEnd} onChange={(e) => setREnd(e.target.value)} />
                  </div>
                </div>
                <Button size="sm" disabled={!rStart || !rEnd || busy} onClick={() => saveReschedule(selected.id)}>
                  Save new dates
                </Button>
              </div>
            )}

            <div>
              <h3 className="mb-xs text-sm font-semibold text-foreground">Chapters</h3>
              <ol className="flex flex-col gap-sm">
                {selected.chapters.map((chapter) => (
                  <li key={chapter.id} className="rounded-md border border-border p-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{chapter.title}</p>
                      <Badge tone={chapter.status === "completed" ? "success" : chapter.status === "delayed" ? "error" : chapter.status === "in-progress" ? "info" : "neutral"}>{statusLabel[chapter.status]}</Badge>
                    </div>
                    {chapter.topics.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-0.5 pl-sm text-xs text-muted-foreground">
                        {chapter.topics.map((topic) => (
                          <li key={topic.id} className="flex items-center gap-1">
                            <span>· {topic.title}</span>
                            {topic.progress?.status === "completed" && <CheckCircle2 className="size-3 text-success" />}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
