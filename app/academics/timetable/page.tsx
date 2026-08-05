"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AlertTriangle, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MobileDayView } from "@/components/academics/timetable/mobile-day-view";
import { TimetableGrid } from "@/components/academics/timetable/timetable-grid";
import { usePermissions } from "@/components/providers/permissions-provider";
import { subjectById, roomById } from "@/lib/data/seed/academics";
import { useManagedClasses, useTeachers } from "@/lib/hooks/use-academics";
import { useTimetableConflicts, useTimetables } from "@/lib/hooks/use-timetable";
import { weekDays } from "@/lib/types/timetable";

type ViewType = "class" | "teacher" | "room";

function TimetablePageContent() {
  const searchParams = useSearchParams();
  const classes = useManagedClasses();
  const teachers = useTeachers();
  const timetables = useTimetables();
  const conflicts = useTimetableConflicts();
  const { can } = usePermissions();

  const [viewType, setViewType] = useState<ViewType>("class");
  const [sectionId, setSectionId] = useState(searchParams.get("section") ?? classes[6]?.sections[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [roomId, setRoomId] = useState("");

  const timetable = useMemo(() => timetables.find((t) => t.sectionId === sectionId), [timetables, sectionId]);

  const teacherTimetable = useMemo(() => {
    if (!teacherId) return null;
    const slots = timetables.flatMap((t) => t.slots.filter((s) => s.teacherId === teacherId).map((s) => ({ ...s, id: `${t.id}-${s.id}` })));
    return { id: "teacher-view", session: "", branchId: "", classId: "", sectionId: "", effectiveFrom: "", status: "published" as const, updatedAt: "", slots };
  }, [timetables, teacherId]);

  const sectionConflicts = conflicts.filter((c) => (timetable ? c.slotIds.some((id) => timetable.slots.some((s) => s.id === id)) : false));

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Timetable</h1>
          <p className="text-xs text-muted-foreground">Class, teacher and room schedules</p>
        </div>
        {can("timetable.manage") && sectionId && (
          <Button asChild size="sm">
            <Link href={`/academics/timetable/create?section=${sectionId}`}>
              <Pencil className="size-3.5" />
              Edit
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-sm">
        <div className="flex items-center gap-1 rounded-md bg-surface-secondary p-1">
          {(["class", "teacher", "room"] as ViewType[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setViewType(v)}
              className={`min-h-11 rounded-md px-md text-xs font-medium capitalize transition-colors sm:min-h-8 ${viewType === v ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}
            >
              {v}
            </button>
          ))}
        </div>

        {viewType === "class" && (
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="w-56" aria-label="Class and section">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) =>
                c.sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {c.name} — Section {s.name}
                  </SelectItem>
                )),
              )}
            </SelectContent>
          </Select>
        )}
        {viewType === "teacher" && (
          <Select value={teacherId} onValueChange={setTeacherId}>
            <SelectTrigger className="w-56" aria-label="Teacher">
              <SelectValue placeholder="Select teacher" />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {viewType === "room" && (
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger className="w-56" aria-label="Room">
              <SelectValue placeholder="Select room" />
            </SelectTrigger>
            <SelectContent>
              {[...new Map(timetables.flatMap((t) => t.slots).filter((s) => s.roomId).map((s) => [s.roomId!, s.roomId!])).values()].map((id) => (
                <SelectItem key={id} value={id}>
                  {roomById(id)?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {sectionConflicts.length > 0 && viewType === "class" && (
        <div className="flex flex-wrap items-center gap-sm rounded-lg border border-error/30 bg-error/10 px-sm py-sm text-xs text-error">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">{sectionConflicts.length} conflict(s) in this timetable</span>
          {sectionConflicts.slice(0, 3).map((c) => (
            <Badge key={c.id} tone="error">
              {c.description}
            </Badge>
          ))}
        </div>
      )}

      {viewType === "class" && timetable && (
        <>
          <div className="hidden sm:block">
            <TimetableGrid timetable={timetable} conflicts={conflicts} />
          </div>
          <div className="sm:hidden">
            <MobileDayView timetable={timetable} />
          </div>
        </>
      )}

      {viewType === "teacher" && teacherTimetable && (
        <>
          <div className="hidden sm:block">
            <TimetableGrid timetable={teacherTimetable} />
          </div>
          <div className="sm:hidden">
            <MobileDayView timetable={teacherTimetable} />
          </div>
        </>
      )}

      {viewType === "room" && roomId && (
        <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
          <table className="w-full min-w-[600px] text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-secondary/60 text-left text-muted-foreground">
                <th className="p-1">Day</th>
                <th className="p-1">Period</th>
                <th className="p-1">Subject</th>
                <th className="p-1">Class</th>
              </tr>
            </thead>
            <tbody>
              {weekDays.flatMap((day) =>
                timetables
                  .flatMap((t) => t.slots.filter((s) => s.roomId === roomId && s.day === day).map((s) => ({ slot: s, t })))
                  .map(({ slot, t }) => (
                    <tr key={`${t.id}-${slot.id}`} className="border-b border-border last:border-0">
                      <td className="p-1 text-foreground">{day}</td>
                      <td className="p-1 text-foreground">P{slot.periodIndex}</td>
                      <td className="p-1 text-foreground">{subjectById(slot.subjectId)?.name}</td>
                      <td className="p-1 text-muted-foreground">{t.sectionId}</td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function TimetablePage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <TimetablePageContent />
    </Suspense>
  );
}
