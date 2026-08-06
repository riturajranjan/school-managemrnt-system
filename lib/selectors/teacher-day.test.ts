import { describe, expect, it } from "vitest";
import { buildTeacherDay } from "./teacher-day";
import type { Db } from "@/lib/data/store";

function makeDb(overrides: Partial<Db>): Db {
  return {
    applications: [],
    students: [],
    guardians: [],
    studentGuardianLinks: [],
    parentAccounts: [],
    importJobs: [],
    savedViews: [],
    classes: [],
    teachers: [],
    rooms: [],
    subjects: [{ id: "subject-math", name: "Mathematics", code: "MATH", shortName: "Math", department: "Mathematics", type: "core", gradeRangeStart: 1, gradeRangeEnd: 10, credit: 4, passingMarks: 33, maxMarks: 100, theoryMarks: 100, practicalMarks: 0, color: "#000", status: "active" }],
    subjectAssignments: [],
    curriculumUnits: [],
    lessonPlans: [],
    homework: [],
    homeworkSubmissions: [],
    academicEvents: [],
    studentSupportAlerts: [],
    attendanceSessions: [],
    attendanceRules: [],
    leaveRequests: [],
    staffAttendance: [],
    timetables: [],
    dismissedConflicts: [],
    exams: [],
    examClasses: [],
    examSubjects: [],
    dismissedExamConflicts: [],
    examAttendance: [],
    studentMarks: [],
    marksEntrySessions: [],
    marksVerifications: [],
    gradingSchemes: [],
    resultRules: [],
    examResults: [],
    resultVersions: [],
    resultPublications: [],
    reportCardTemplates: [],
    reportCards: [],
    reportCardGenerationJobs: [],
    teacherRemarks: [],
    promotionRules: [],
    promotionRuns: [],
    examAuditLog: [],
    ...overrides,
  };
}

describe("buildTeacherDay", () => {
  it("sorts timed items chronologically by start time", () => {
    const today = new Date();
    const weekdayIndex = today.getDay() - 1;
    if (weekdayIndex < 0 || weekdayIndex > 5) return; // weekend — nothing scheduled to sort, skip
    const weekDayName = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekdayIndex] as
      | "Monday"
      | "Tuesday"
      | "Wednesday"
      | "Thursday"
      | "Friday"
      | "Saturday";

    const db = makeDb({
      timetables: [
        {
          id: "tt-1",
          session: "2026-2027",
          branchId: "main",
          classId: "class-1",
          sectionId: "section-1",
          effectiveFrom: today.toISOString(),
          status: "published",
          updatedAt: today.toISOString(),
          slots: [
            { id: "slot-late", day: weekDayName, periodIndex: 9, subjectId: "subject-math", teacherId: "teacher-1", locked: false },
            { id: "slot-early", day: weekDayName, periodIndex: 1, subjectId: "subject-math", teacherId: "teacher-1", locked: false },
          ],
        },
      ],
    });

    const items = buildTeacherDay(db, "teacher-1");
    const classItems = items.filter((i) => i.kind === "class");
    expect(classItems[0].id).toContain("slot-early");
    expect(classItems[1].id).toContain("slot-late");
  });

  it("includes only the targeted teacher's classes", () => {
    const today = new Date();
    const weekdayIndex = today.getDay() - 1;
    if (weekdayIndex < 0 || weekdayIndex > 5) return;
    const weekDayName = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekdayIndex] as
      | "Monday"
      | "Tuesday"
      | "Wednesday"
      | "Thursday"
      | "Friday"
      | "Saturday";

    const db = makeDb({
      timetables: [
        {
          id: "tt-1",
          session: "2026-2027",
          branchId: "main",
          classId: "class-1",
          sectionId: "section-1",
          effectiveFrom: today.toISOString(),
          status: "published",
          updatedAt: today.toISOString(),
          slots: [
            { id: "slot-mine", day: weekDayName, periodIndex: 1, subjectId: "subject-math", teacherId: "teacher-1", locked: false },
            { id: "slot-other", day: weekDayName, periodIndex: 2, subjectId: "subject-math", teacherId: "teacher-2", locked: false },
          ],
        },
      ],
    });

    const items = buildTeacherDay(db, "teacher-1");
    expect(items.filter((i) => i.kind === "class")).toHaveLength(1);
  });
});
