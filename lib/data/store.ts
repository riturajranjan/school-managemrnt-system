import type { AdmissionApplication } from "@/lib/types/admissions";
import type { Guardian, ParentAccount, Student, StudentGuardianLink } from "@/lib/types/students";
import type { ImportJob } from "@/lib/types/import";
import type { SavedView } from "@/lib/types/views";
import type {
  AcademicEvent,
  CurriculumUnit,
  Homework,
  HomeworkSubmission,
  LessonPlan,
  ManagedClass,
  Room,
  StudentSupportAlert,
  Subject,
  SubjectAssignment,
  Teacher,
} from "@/lib/types/academics";
import type { AttendanceRule, AttendanceSession, LeaveRequest, StaffAttendance } from "@/lib/types/attendance";
import type { DismissedConflict, Timetable } from "@/lib/types/timetable";
import type { DismissedExamConflict, Exam, ExamAttendanceRecord, ExamAuditEntry, ExamClass, ExamSubject } from "@/lib/types/exams";
import type { GradingScheme, ResultRule } from "@/lib/types/grading";
import type { MarksEntrySession, MarksVerification, StudentMark } from "@/lib/types/marks";
import type { ReportCard, ReportCardGenerationJob, ReportCardTemplate, TeacherRemark } from "@/lib/types/report-cards";
import type { ResultPublication, ResultVersion, StudentResult } from "@/lib/types/results";
import type { PromotionRule, PromotionRun } from "@/lib/types/promotion";
import { generateAdmissionApplications } from "./seed/admissions";
import { generateStudents } from "./seed/students";
import {
  academicEvents,
  curriculumUnits,
  generateHomeworkSubmissions,
  generateStudentSupportAlerts,
  homeworkList,
  lessonPlans,
  managedClasses,
  rooms,
  subjectAssignments,
  subjects,
  teachers,
} from "./seed/academics";
import { attendanceRules, generateAttendanceSessions, leaveRequests, staffAttendanceToday } from "./seed/attendance";
import { timetables } from "./seed/timetable";
import { examClasses, examSubjects, exams, generateExamStudentData, gradingSchemes, reportCardTemplates, resultRules } from "./seed/exams";

export type Db = {
  applications: AdmissionApplication[];
  students: Student[];
  guardians: Guardian[];
  studentGuardianLinks: StudentGuardianLink[];
  parentAccounts: ParentAccount[];
  importJobs: ImportJob[];
  savedViews: SavedView[];
  classes: ManagedClass[];
  teachers: Teacher[];
  rooms: Room[];
  subjects: Subject[];
  subjectAssignments: SubjectAssignment[];
  curriculumUnits: CurriculumUnit[];
  lessonPlans: LessonPlan[];
  homework: Homework[];
  homeworkSubmissions: HomeworkSubmission[];
  academicEvents: AcademicEvent[];
  studentSupportAlerts: StudentSupportAlert[];
  attendanceSessions: AttendanceSession[];
  attendanceRules: AttendanceRule[];
  leaveRequests: LeaveRequest[];
  staffAttendance: StaffAttendance[];
  timetables: Timetable[];
  dismissedConflicts: DismissedConflict[];
  // Phase 4 — examinations, marks, results, report cards, promotion
  exams: Exam[];
  examClasses: ExamClass[];
  examSubjects: ExamSubject[];
  dismissedExamConflicts: DismissedExamConflict[];
  examAttendance: ExamAttendanceRecord[];
  studentMarks: StudentMark[];
  marksEntrySessions: MarksEntrySession[];
  marksVerifications: MarksVerification[];
  gradingSchemes: GradingScheme[];
  resultRules: ResultRule[];
  examResults: StudentResult[];
  resultVersions: ResultVersion[];
  resultPublications: ResultPublication[];
  reportCardTemplates: ReportCardTemplate[];
  reportCards: ReportCard[];
  reportCardGenerationJobs: ReportCardGenerationJob[];
  teacherRemarks: TeacherRemark[];
  promotionRules: PromotionRule[];
  promotionRuns: PromotionRun[];
  examAuditLog: ExamAuditEntry[];
};

const STORAGE_KEY = "novyra-sis-store-v2";

function buildSeedDb(): Db {
  const applications = generateAdmissionApplications();
  const { students, guardians, studentGuardianLinks, parentAccounts } = generateStudents();
  const homeworkSubmissions = generateHomeworkSubmissions(students, homeworkList);
  const studentSupportAlerts = generateStudentSupportAlerts(students);
  const attendanceSessions = generateAttendanceSessions(students);
  const examStudentData = generateExamStudentData(students);

  return {
    applications,
    students,
    guardians,
    studentGuardianLinks,
    parentAccounts,
    importJobs: [],
    savedViews: [],
    classes: structuredClone(managedClasses),
    teachers,
    rooms,
    subjects,
    subjectAssignments,
    curriculumUnits,
    lessonPlans,
    homework: homeworkList,
    homeworkSubmissions,
    academicEvents,
    studentSupportAlerts,
    attendanceSessions,
    attendanceRules,
    leaveRequests,
    staffAttendance: staffAttendanceToday,
    timetables,
    dismissedConflicts: [],
    exams,
    examClasses,
    examSubjects,
    dismissedExamConflicts: [],
    examAttendance: examStudentData.examAttendance,
    studentMarks: examStudentData.studentMarks,
    marksEntrySessions: examStudentData.marksEntrySessions,
    marksVerifications: examStudentData.marksVerifications,
    gradingSchemes,
    resultRules,
    examResults: examStudentData.studentResults,
    resultVersions: examStudentData.resultVersions,
    resultPublications: examStudentData.resultPublications,
    reportCardTemplates,
    reportCards: examStudentData.reportCards,
    reportCardGenerationJobs: [],
    teacherRemarks: examStudentData.teacherRemarks,
    promotionRules: [],
    promotionRuns: [],
    examAuditLog: [],
  };
}

// Seeded deterministically so the very first server-rendered HTML and the
// client's pre-hydration render are byte-identical — localStorage (which can
// differ from the seed) is only applied afterwards, via hydrateFromStorage(),
// so it lands as a normal post-mount state update rather than a hydration
// mismatch.
let state: Db = buildSeedDb();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable (private browsing) — in-memory state still works for this session.
  }
}

export function getSnapshot(): Db {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hydrateFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Db;
    if (parsed && Array.isArray(parsed.applications) && Array.isArray(parsed.students) && Array.isArray(parsed.classes)) {
      // Older cached snapshots predate the conflict-dismissal feature and the whole Phase 4
      // exams domain — backfill missing fields rather than force a full reseed.
      state = {
        ...parsed,
        dismissedConflicts: parsed.dismissedConflicts ?? [],
        exams: parsed.exams ?? exams,
        examClasses: parsed.examClasses ?? examClasses,
        examSubjects: parsed.examSubjects ?? examSubjects,
        dismissedExamConflicts: parsed.dismissedExamConflicts ?? [],
        examAttendance: parsed.examAttendance ?? [],
        studentMarks: parsed.studentMarks ?? [],
        marksEntrySessions: parsed.marksEntrySessions ?? [],
        marksVerifications: parsed.marksVerifications ?? [],
        gradingSchemes: parsed.gradingSchemes ?? gradingSchemes,
        resultRules: parsed.resultRules ?? resultRules,
        examResults: parsed.examResults ?? [],
        resultVersions: parsed.resultVersions ?? [],
        resultPublications: parsed.resultPublications ?? [],
        reportCardTemplates: parsed.reportCardTemplates ?? reportCardTemplates,
        reportCards: parsed.reportCards ?? [],
        reportCardGenerationJobs: parsed.reportCardGenerationJobs ?? [],
        teacherRemarks: parsed.teacherRemarks ?? [],
        promotionRules: parsed.promotionRules ?? [],
        promotionRuns: parsed.promotionRuns ?? [],
        examAuditLog: parsed.examAuditLog ?? [],
      };
      notify();
    }
  } catch {
    // Corrupt or incompatible snapshot — keep the freshly seeded in-memory state.
  }
}

export function resetDemoData() {
  state = buildSeedDb();
  persist();
  notify();
}

/** Applies an immutable update to the store and notifies + persists. Internal — services call this, UI never should. */
export function setState(updater: (draft: Db) => Db) {
  state = updater(state);
  persist();
  notify();
}
