"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { CalendarClock, CheckCircle2, NotebookPen } from "lucide-react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { teacherById } from "@/lib/data/seed/academics";
import { addUnitNote, markUnitComplete, reschedulePlannedDates } from "@/lib/services/curriculum-service";
import { useInView } from "@/lib/hooks/use-in-view";
import { progressStatusLabels, progressStatusTone, type CurriculumUnit, type ProgressStatus } from "@/lib/types/academics";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const nodeFill: Record<ProgressStatus, string> = {
  completed: "bg-success text-success-foreground",
  "in-progress": "bg-info text-info-foreground",
  planned: "bg-surface-secondary text-muted-foreground",
  "not-started": "bg-surface-secondary text-muted-foreground",
  delayed: "bg-error text-error-foreground",
  skipped: "bg-surface-secondary text-muted-foreground line-through",
  "needs-review": "bg-warning text-warning-foreground",
};

const ringStroke: Record<ProgressStatus, string> = {
  completed: "var(--color-success)",
  "in-progress": "var(--color-info)",
  planned: "var(--color-border)",
  "not-started": "var(--color-border)",
  delayed: "var(--color-error)",
  skipped: "var(--color-border)",
  "needs-review": "var(--color-warning)",
};

const lineTone: Record<ProgressStatus, string> = {
  completed: "bg-success",
  "in-progress": "bg-info",
  planned: "bg-border",
  "not-started": "bg-border",
  delayed: "bg-error",
  skipped: "bg-border",
  "needs-review": "bg-warning",
};

/** A raised node with a progress ring — completedPeriods/estimatedPeriods traced around
 * the badge, giving each node a lightweight sense of depth without WebGL. */
function ProgressRing({ percent, status, selected, children }: { percent: number; status: ProgressStatus; selected: boolean; children: React.ReactNode }) {
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
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringStroke[status]}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      {children}
    </span>
  );
}

export function LearningPathTimeline({ units }: { units: CurriculumUnit[] }) {
  const reduceMotion = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [rStart, setRStart] = useState("");
  const [rEnd, setREnd] = useState("");
  const [noteText, setNoteText] = useState("");
  const sorted = [...units].sort((a, b) => a.sequence - b.sequence);
  const selected = sorted.find((u) => u.id === selectedId) ?? null;

  if (sorted.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No curriculum units tracked yet.</p>;
  }

  function openUnit(unit: CurriculumUnit) {
    setSelectedId(unit.id);
    setRescheduling(false);
    setRStart(unit.plannedStart.slice(0, 10));
    setREnd(unit.plannedEnd.slice(0, 10));
    setNoteText("");
  }

  return (
    <div ref={ref} className="flex flex-col gap-sm">
      <div className="scrollbar-none flex items-start gap-0 overflow-x-auto pb-sm pt-1">
        {sorted.map((unit, index) => {
          const percent = unit.estimatedPeriods === 0 ? 0 : Math.min(100, Math.round((unit.completedPeriods / unit.estimatedPeriods) * 100));
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
                    {unit.sequence}
                  </span>
                </ProgressRing>
                <span className="line-clamp-2 text-xs font-medium text-foreground">{unit.title}</span>
                <Badge tone={progressStatusTone[unit.status]} className="text-[10px]">
                  {progressStatusLabels[unit.status]}
                </Badge>
              </motion.button>
            </div>
          );
        })}
      </div>

      <DetailDrawer open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)} title={selected?.title ?? ""} description={selected?.description}>
        {selected && (
          <div className="flex flex-col gap-md">
            <div className="grid grid-cols-2 gap-sm text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Planned</p>
                <p className="text-foreground">
                  {formatDate(selected.plannedStart)} – {formatDate(selected.plannedEnd)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Actual completion</p>
                <p className="text-foreground">{selected.actualCompletion ? formatDate(selected.actualCompletion) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Teacher</p>
                <p className="text-foreground">{teacherById(selected.teacherId)?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining periods</p>
                <p className="text-foreground">{Math.max(selected.estimatedPeriods - selected.completedPeriods, 0)} of {selected.estimatedPeriods}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="text-foreground">{selected.estimatedPeriods === 0 ? 0 : Math.round((selected.completedPeriods / selected.estimatedPeriods) * 100)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge tone={progressStatusTone[selected.status]}>{progressStatusLabels[selected.status]}</Badge>
              </div>
            </div>

            {selected.status !== "completed" && (
              <div className="flex flex-wrap items-center gap-xs">
                <Button size="sm" variant="outline" onClick={() => setRescheduling((v) => !v)}>
                  <CalendarClock className="size-3.5" />
                  Reschedule
                </Button>
                <Button size="sm" variant="outline" onClick={() => markUnitComplete(selected.id)}>
                  <CheckCircle2 className="size-3.5" />
                  Mark complete
                </Button>
              </div>
            )}

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
                <Button
                  size="sm"
                  disabled={!rStart || !rEnd}
                  onClick={() => {
                    reschedulePlannedDates(selected.id, rStart, rEnd);
                    setRescheduling(false);
                  }}
                >
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
                      <Badge tone={progressStatusTone[chapter.status]}>{progressStatusLabels[chapter.status]}</Badge>
                    </div>
                    {chapter.topics.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-0.5 pl-sm text-xs text-muted-foreground">
                        {chapter.topics.map((topic) => (
                          <li key={topic.id}>· {topic.title}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h3 className="mb-xs flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <NotebookPen className="size-3.5" /> Notes
              </h3>
              {selected.notes && selected.notes.length > 0 ? (
                <ul className="mb-sm flex flex-col gap-1.5">
                  {[...selected.notes].reverse().map((note) => (
                    <li key={note.id} className="rounded-md border border-border p-sm text-xs">
                      <p className="text-foreground">{note.text}</p>
                      <p className="mt-0.5 text-muted-foreground">
                        {note.author} · {formatDate(note.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-sm text-xs text-muted-foreground">No notes yet.</p>
              )}
              <div className="flex flex-col gap-xs">
                <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note about this unit's progress…" rows={2} aria-label="New note" />
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  disabled={!noteText.trim()}
                  onClick={() => {
                    addUnitNote(selected.id, noteText.trim(), "Academic Coordinator");
                    setNoteText("");
                  }}
                >
                  Add note
                </Button>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
