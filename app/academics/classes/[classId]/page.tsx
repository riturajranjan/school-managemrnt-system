"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { ClassRosterMobileCard, buildClassRosterColumns } from "@/components/academics/classes/class-roster-table";
import { useGoToStudent } from "@/components/students/student-table";
import { TimelineList } from "@/components/timeline/timeline-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CapacityBar } from "@/components/academics/classes/capacity-bar";
import { classCapacity } from "@/components/academics/classes/class-table";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { roomById, subjectById, teacherById } from "@/lib/data/seed/academics";
import { useManagedClass, useSubjects, useTeachers } from "@/lib/hooks/use-academics";
import { useHomeworkList } from "@/lib/hooks/use-academics";
import { useAttendanceSessions } from "@/lib/hooks/use-attendance";
import { useLessonPlans } from "@/lib/hooks/use-academics";
import { useSisStore } from "@/lib/hooks/use-store";
import { classAttendanceTodayPercent, classCurriculumCompletionPercent, classRoomNames, classTeacherNames } from "@/lib/selectors/class-insights";
import { createAssignment } from "@/lib/services/subjects-service";
import { homeworkStatusTone } from "@/lib/types/academics";
import { formatDate } from "@/lib/utils";

export default function ClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const schoolClass = useManagedClass(classId);
  const db = useSisStore();
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const teachers = useTeachers();
  const subjects = useSubjects();
  const goToStudent = useGoToStudent();
  const allHomework = useHomeworkList();
  const allLessonPlans = useLessonPlans();
  const attendanceSessions = useAttendanceSessions();
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSectionId, setAssignSectionId] = useState("");
  const [assignSubjectId, setAssignSubjectId] = useState("");
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assignError, setAssignError] = useState("");

  const sectionIds = useMemo(() => schoolClass?.sections.map((s) => s.id) ?? [], [schoolClass]);
  const students = useMemo(() => db.students.filter((s) => sectionIds.includes(s.sectionId)), [db.students, sectionIds]);
  const assignments = useMemo(() => db.subjectAssignments.filter((a) => a.classId === classId), [db.subjectAssignments, classId]);
  const classHomework = useMemo(() => allHomework.filter((h) => h.classId === classId), [allHomework, classId]);
  const classLessonPlans = useMemo(() => allLessonPlans.filter((p) => p.classId === classId), [allLessonPlans, classId]);
  const classTeacherIds = useMemo(() => new Set(assignments.map((a) => a.primaryTeacherId)), [assignments]);

  if (!capabilitiesLoading && !hasServerPermission("academics.view")) {
    return <PermissionDenied action="view this class" role={roleLabels[role]} backHref="/academics/classes" />;
  }

  if (!schoolClass) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Class not found</p>
        <Button asChild variant="outline">
          <Link href="/academics/classes">Back to Classes</Link>
        </Button>
      </div>
    );
  }

  const { capacity, enrolled } = classCapacity(schoolClass);
  const studentColumns = buildClassRosterColumns();

  const activity = [
    ...classLessonPlans.slice(0, 5).map((p) => ({
      id: p.id,
      subjectId: p.id,
      category: "academic" as const,
      title: `Lesson plan ${p.status} — ${subjectById(p.subjectId)?.name}`,
      actorName: teacherById(p.teacherId)?.name ?? "Teacher",
      createdAt: p.updatedAt,
    })),
    ...classHomework.slice(0, 5).map((h) => ({
      id: h.id,
      subjectId: h.id,
      category: "academic" as const,
      title: `Homework "${h.title}" ${h.status}`,
      actorName: teacherById(h.teacherId)?.name ?? "Teacher",
      createdAt: h.updatedAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-sm sm:p-md">
        <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-xs">
              <h1 className="text-base font-semibold text-foreground">{schoolClass.name}</h1>
              <Badge tone={schoolClass.status === "active" ? "success" : "neutral"}>{schoolClass.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{schoolClass.sections.length} section{schoolClass.sections.length === 1 ? "" : "s"}</p>
          </div>
          <div className="sm:w-48">
            <CapacityBar enrolled={enrolled} capacity={capacity} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-sm border-t border-border pt-sm text-xs sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Class teacher(s)</p>
            <p className="font-medium text-foreground">{classTeacherNames(schoolClass).join(", ") || "Unassigned"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Room(s)</p>
            <p className="font-medium text-foreground">{classRoomNames(schoolClass).join(", ") || "Unassigned"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Attendance today</p>
            <p className="font-medium text-foreground">{classAttendanceTodayPercent(db, schoolClass) ?? "—"}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Curriculum progress</p>
            <p className="font-medium text-foreground">{classCurriculumCompletionPercent(db, classId)}%</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="homework">Homework</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-md">
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            {schoolClass.sections.map((section) => (
              <div key={section.id} className="flex flex-col gap-sm rounded-lg border border-border p-sm">
                <p className="text-sm font-semibold text-foreground">Section {section.name}</p>
                <CapacityBar enrolled={section.enrolledCount} capacity={section.capacity} />
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <p>Class teacher: {teacherById(section.classTeacherId)?.name ?? "Unassigned"}</p>
                  <p>Room: {roomById(section.roomId)?.name ?? "Unassigned"}</p>
                  <p>Shift: {section.shift}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="students" className="mt-md">
          <DataTable
            columns={studentColumns}
            rows={students}
            getRowId={(s) => s.id}
            caption="Students in this class"
            onRowClick={(s) => goToStudent(s.id)}
            renderMobileCard={(s) => <ClassRosterMobileCard student={s} onOpen={() => goToStudent(s.id)} />}
            emptyTitle="No students yet"
          />
        </TabsContent>

        <TabsContent value="subjects" className="mt-md">
          <div className="flex flex-col gap-sm">
            {can("academics.manageSubjects") && (
              <Button size="sm" variant="outline" className="self-start" onClick={() => setAssignOpen(true)}>
                <Plus className="size-3.5" />
                Assign subject
              </Button>
            )}
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subjects assigned yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-secondary/60 text-left text-xs text-muted-foreground">
                      <th className="px-sm py-sm">Subject</th>
                      <th className="px-sm py-sm">Section</th>
                      <th className="px-sm py-sm">Teacher</th>
                      <th className="px-sm py-sm">Weekly periods</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="px-sm py-sm text-foreground">{subjectById(a.subjectId)?.name}</td>
                        <td className="px-sm py-sm text-muted-foreground">{schoolClass.sections.find((s) => s.id === a.sectionId)?.name}</td>
                        <td className="px-sm py-sm text-muted-foreground">{teacherById(a.primaryTeacherId)?.name}</td>
                        <td className="px-sm py-sm text-muted-foreground">{a.weeklyPeriods}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="teachers" className="mt-md">
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            {teachers
              .filter((t) => classTeacherIds.has(t.id))
              .map((t) => (
                <Link key={t.id} href={`/teachers/${t.id}`} className="rounded-lg border border-border p-sm hover:bg-surface-secondary/60">
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.department}</p>
                </Link>
              ))}
            {classTeacherIds.size === 0 && <p className="text-sm text-muted-foreground">No teachers assigned yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="timetable" className="mt-md">
          <div className="flex flex-col gap-sm">
            {schoolClass.sections.map((section) => (
              <Link
                key={section.id}
                href={`/academics/timetable?section=${section.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-sm hover:bg-surface-secondary/60"
              >
                <span className="text-sm text-foreground">Section {section.name} timetable</span>
                <BookOpen className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-md">
          <div className="flex flex-col gap-sm">
            {schoolClass.sections.map((section) => {
              const today = new Date().toISOString().slice(0, 10);
              const marked = attendanceSessions.some((s) => s.sectionId === section.id && s.date.slice(0, 10) === today && s.mode === "daily");
              return (
                <Link
                  key={section.id}
                  href={`/attendance/students?section=${section.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-sm hover:bg-surface-secondary/60"
                >
                  <span className="text-sm text-foreground">Section {section.name}</span>
                  <Badge tone={marked ? "success" : "warning"}>{marked ? "Marked today" : "Not marked"}</Badge>
                </Link>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="homework" className="mt-md">
          {classHomework.length === 0 ? (
            <p className="text-sm text-muted-foreground">No homework assigned yet.</p>
          ) : (
            <ul className="flex flex-col gap-sm">
              {classHomework.map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-lg border border-border p-sm">
                  <div>
                    <p className="text-sm font-medium text-foreground">{h.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {subjectById(h.subjectId)?.name} · Due {formatDate(h.dueDate)}
                    </p>
                  </div>
                  <Badge tone={homeworkStatusTone[h.status]}>{h.status.replace("-", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="exams" className="mt-md">
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
            Exam scheduling and results are planned for a future phase.
          </p>
        </TabsContent>
        <TabsContent value="announcements" className="mt-md">
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
            Class announcements are planned for a future phase.
          </p>
        </TabsContent>

        <TabsContent value="activity" className="mt-md">
          <TimelineList events={activity} emptyMessage="No recent activity for this class." />
        </TabsContent>
      </Tabs>

      <DetailDrawer open={assignOpen} onOpenChange={setAssignOpen} title="Assign subject" description="Add a subject to a section with a teacher">
        <div className="flex flex-col gap-sm">
          {assignError && (
            <p className="flex items-center gap-1 text-xs text-error">
              <AlertTriangle className="size-3.5" /> {assignError}
            </p>
          )}
          <div>
            <Label>Section</Label>
            <Select value={assignSectionId} onValueChange={setAssignSectionId}>
              <SelectTrigger aria-label="Section">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {schoolClass.sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    Section {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject</Label>
            <Select value={assignSubjectId} onValueChange={setAssignSubjectId}>
              <SelectTrigger aria-label="Subject">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Teacher</Label>
            <Select value={assignTeacherId} onValueChange={setAssignTeacherId}>
              <SelectTrigger aria-label="Teacher">
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
          </div>
          <Button
            onClick={() => {
              if (!assignSectionId || !assignSubjectId || !assignTeacherId) {
                setAssignError("Select a section, subject, and teacher.");
                return;
              }
              const result = createAssignment(
                { classId, sectionId: assignSectionId, subjectId: assignSubjectId, primaryTeacherId: assignTeacherId, weeklyPeriods: 4, session: db.students[0]?.session ?? "2026-2027" },
                schoolClass.order,
              );
              if ("errors" in result) {
                setAssignError(result.errors.join(" "));
                return;
              }
              setAssignOpen(false);
              setAssignError("");
            }}
          >
            Assign
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
