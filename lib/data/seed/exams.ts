import type { Exam, ExamAttendanceRecord, ExamClass, ExamSubject } from "@/lib/types/exams";
import type { GradeRange, GradingScheme, ResultRule } from "@/lib/types/grading";
import type { MarksEntrySession, MarksVerification, StudentMark } from "@/lib/types/marks";
import type { ReportCard, ReportCardTemplate, TeacherRemark } from "@/lib/types/report-cards";
import type { ResultPublication, ResultVersion, StudentResult } from "@/lib/types/results";
import { calculateExamResults } from "@/lib/services/result-engine";
import { periodDefinitions, weekDays } from "@/lib/types/timetable";
import { assignmentsForSection, rooms, subjectsForGrade, teachers } from "./academics";
import { CURRENT_SESSION, schoolClasses } from "./reference";
import { seededHelpers } from "./rng";
import { timetables } from "./timetable";

const { int, bool, daysAgoIso, daysFromNowIso } = seededHelpers(52082026);

const class3 = schoolClasses.find((c) => c.name === "Class 3")!;
const class9 = schoolClasses.find((c) => c.name === "Class 9")!;
const class10 = schoolClasses.find((c) => c.name === "Class 10")!;

// --- Grading schemes -------------------------------------------------------

const cbseRanges: GradeRange[] = [
  { id: "gr-a1", name: "A1", minPercent: 91, maxPercent: 100, gradePoint: 10, color: "#158a5f", isPass: true, order: 1 },
  { id: "gr-a2", name: "A2", minPercent: 81, maxPercent: 90, gradePoint: 9, color: "#35c98d", isPass: true, order: 2 },
  { id: "gr-b1", name: "B1", minPercent: 71, maxPercent: 80, gradePoint: 8, color: "#18b0c8", isPass: true, order: 3 },
  { id: "gr-b2", name: "B2", minPercent: 61, maxPercent: 70, gradePoint: 7, color: "#4fd1e1", isPass: true, order: 4 },
  { id: "gr-c1", name: "C1", minPercent: 51, maxPercent: 60, gradePoint: 6, color: "#2f7dd1", isPass: true, order: 5 },
  { id: "gr-c2", name: "C2", minPercent: 41, maxPercent: 50, gradePoint: 5, color: "#e2a53d", isPass: true, order: 6 },
  { id: "gr-d", name: "D", minPercent: 33, maxPercent: 40, gradePoint: 4, color: "#b5730b", isPass: true, order: 7 },
  { id: "gr-e", name: "E", minPercent: 0, maxPercent: 32, gradePoint: 0, color: "#d1403a", isPass: false, order: 8 },
];

const primaryRanges: GradeRange[] = [
  { id: "gr-outstanding", name: "Outstanding", minPercent: 91, maxPercent: 100, color: "#158a5f", isPass: true, order: 1 },
  { id: "gr-verygood", name: "Very Good", minPercent: 75, maxPercent: 90, color: "#35c98d", isPass: true, order: 2 },
  { id: "gr-good", name: "Good", minPercent: 60, maxPercent: 74, color: "#18b0c8", isPass: true, order: 3 },
  { id: "gr-satisfactory", name: "Satisfactory", minPercent: 40, maxPercent: 59, color: "#e2a53d", isPass: true, order: 4 },
  { id: "gr-needsimprovement", name: "Needs Improvement", minPercent: 0, maxPercent: 39, color: "#d1403a", isPass: false, order: 5 },
];

export const gradingSchemes: GradingScheme[] = [
  {
    id: "gs-cbse",
    name: "CBSE Pattern (Secondary)",
    system: "letter",
    session: CURRENT_SESSION,
    applicableClassIds: [class9.id, class10.id],
    applicableSubjectIds: [],
    status: "active",
    ranges: cbseRanges,
    createdAt: daysAgoIso(200),
    updatedAt: daysAgoIso(30),
  },
  {
    id: "gs-primary",
    name: "Primary Descriptive",
    system: "descriptive",
    session: CURRENT_SESSION,
    applicableClassIds: [class3.id],
    applicableSubjectIds: [],
    status: "active",
    ranges: primaryRanges,
    createdAt: daysAgoIso(200),
    updatedAt: daysAgoIso(30),
  },
];

export const resultRules: ResultRule[] = [
  {
    id: "rr-standard",
    name: "Standard Secondary Rules",
    gradingSchemeId: "gs-cbse",
    minTheoryPercent: 33,
    minPracticalPercent: 33,
    maxFailedSubjects: 2,
    graceMarksLimit: 10,
    attendanceEligibilityPercent: 75,
    rankInclusion: "pass-only",
    bestOfEnabled: false,
    roundingRule: "nearest",
    decimalPrecision: 1,
    tieBreaker: "higher-theory",
    createdAt: daysAgoIso(200),
    updatedAt: daysAgoIso(30),
  },
  {
    id: "rr-primary",
    name: "Primary Assessment Rules",
    gradingSchemeId: "gs-primary",
    maxFailedSubjects: 6,
    graceMarksLimit: 5,
    rankInclusion: "all",
    bestOfEnabled: false,
    roundingRule: "nearest",
    decimalPrecision: 0,
    tieBreaker: "none",
    createdAt: daysAgoIso(200),
    updatedAt: daysAgoIso(30),
  },
];

export const reportCardTemplates: ReportCardTemplate[] = [
  {
    id: "rct-default",
    name: "Standard Report Card",
    theme: "modern-minimal",
    pageSize: "a4",
    orientation: "portrait",
    sections: [
      { key: "header", visible: true, order: 1 },
      { key: "student-info", visible: true, order: 2 },
      { key: "subject-marks", visible: true, order: 3 },
      { key: "grade-summary", visible: true, order: 4 },
      { key: "attendance", visible: true, order: 5 },
      { key: "co-curricular", visible: false, order: 6 },
      { key: "skills", visible: false, order: 7 },
      { key: "teacher-remark", visible: true, order: 8 },
      { key: "principal-remark", visible: true, order: 9 },
      { key: "promotion-status", visible: true, order: 10 },
      { key: "signatures", visible: true, order: 11 },
      { key: "qr-verification", visible: false, order: 12 },
      { key: "footer", visible: true, order: 13 },
    ],
    showLogo: true,
    showPhoto: true,
    showQrVerification: false,
    signatureLabels: ["Class Teacher", "Examination Controller", "Principal"],
    footerNote: "This is a computer-generated report card.",
    assignedClassIds: [],
    session: CURRENT_SESSION,
    status: "active",
    createdAt: daysAgoIso(180),
    updatedAt: daysAgoIso(30),
  },
];

// --- Exams + subject configuration -----------------------------------------

const labRoomIds = ["lab-physics", "lab-chem", "lab-computer"];
const classroomIds = rooms.filter((r) => r.type === "classroom").map((r) => r.id);

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function weekdayForDate(dateStr: string) {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 6 ? weekDays[day - 1] : undefined;
}

function isTeacherFree(teacherId: string, dateStr: string, startTime: string, endTime: string): boolean {
  const weekday = weekdayForDate(dateStr);
  if (!weekday) return true;
  return !timetables
    .flatMap((t) => t.slots.filter((s) => s.teacherId === teacherId && s.day === weekday && s.subjectId))
    .some((slot) => {
      const period = periodDefinitions.find((p) => p.index === slot.periodIndex);
      return period ? toMinutes(period.startTime) < toMinutes(endTime) && toMinutes(startTime) < toMinutes(period.endTime) : false;
    });
}

// Simple deterministic round-robin, biased toward whoever's free on their regular
// timetable at this slot when there's a clear choice — not an exhaustive search, since
// with enough concurrent sections some regular-timetable overlap is a genuine,
// realistic scheduling constraint the conflict detector is meant to surface, not one
// the seed should silently engineer away.
function pickInvigilator(dateStr: string, startTime: string, endTime: string, globalSlot: number): string {
  const primary = teachers[globalSlot % teachers.length];
  if (isTeacherFree(primary.id, dateStr, startTime, endTime)) return primary.id;
  const fallback = teachers[(globalSlot + 1) % teachers.length];
  return isTeacherFree(fallback.id, dateStr, startTime, endTime) ? fallback.id : primary.id;
}

// sectionOrdinal/sectionCount are a section's position among ALL sections sitting this
// exam (not reset per class) — every room/invigilator formula below is keyed off that
// global position so concurrent sections never land on the same room or invigilator at
// the same slot. Practicals additionally stagger by day since there are only 3 labs.
function buildExamSubjects(examId: string, classId: string, sectionId: string, sectionOrdinal: number, sectionCount: number, baseDate: Date, scheduled: boolean): ExamSubject[] {
  const subjectList = subjectsForGrade(schoolClasses.find((c) => c.id === classId)!.order);
  return subjectList.map((subject, index) => {
    const isPractical = subject.type === "practical";
    const dayOffset = Math.floor(index / 2) + (isPractical ? sectionOrdinal % 2 : 0);
    const date = new Date(baseDate);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    const isMorning = index % 2 === 0;
    const startTime = isMorning ? "09:00" : "11:30";
    const endTime = isMorning ? "11:00" : "13:00";
    const dateStr = date.toISOString().slice(0, 10);
    const assignment = assignmentsForSection(sectionId).find((a) => a.subjectId === subject.id);
    const globalSlot = index * sectionCount + sectionOrdinal;
    const roomId = isPractical ? labRoomIds[sectionOrdinal % labRoomIds.length] : classroomIds[globalSlot % classroomIds.length];
    // Invigilators are drawn from the general staff roster (not the subject's own
    // teacher, matching how real schools avoid a specialist invigilating their own
    // paper) and picked from whoever's actually free on their regular timetable at
    // this slot, so the seed doesn't manufacture avoidable teacher-overlap conflicts.
    const invigilatorId = pickInvigilator(dateStr, startTime, endTime, globalSlot);
    return {
      id: `es-${examId}-${sectionId}-${subject.id}`,
      examId,
      classId,
      sectionId,
      subjectId: subject.id,
      date: scheduled ? dateStr : undefined,
      startTime: scheduled ? startTime : undefined,
      endTime: scheduled ? endTime : undefined,
      maxMarks: subject.maxMarks,
      passingMarks: subject.passingMarks,
      theoryMarks: subject.theoryMarks,
      practicalMarks: subject.practicalMarks,
      internalMarks: 0,
      projectMarks: 0,
      graceMarksLimit: 5,
      weightage: Math.round(100 / subjectList.length),
      roomId: scheduled ? roomId : undefined,
      examinerId: assignment?.primaryTeacherId,
      invigilatorId: scheduled ? invigilatorId : undefined,
      markEntryTeacherId: assignment?.primaryTeacherId,
      verificationTeacherId: assignment?.primaryTeacherId,
      instructions: isPractical ? "Bring lab coat and calculator." : "Bring your own stationery.",
      locked: false,
    };
  });
}

export const exams: Exam[] = [
  {
    id: "exam-unit1",
    name: "Unit Test 1",
    code: "UT1-2627",
    type: "unit-test",
    session: CURRENT_SESSION,
    branchId: "main",
    term: "Term 1",
    description: "First unit assessment covering chapters 1-3 across core subjects.",
    startDate: daysAgoIso(45).slice(0, 10),
    endDate: daysAgoIso(40).slice(0, 10),
    resultDate: daysAgoIso(30).slice(0, 10),
    status: "published",
    scope: "internal",
    mode: "offline",
    classIds: [class9.id],
    gradingSchemeId: "gs-cbse",
    resultRuleId: "rr-standard",
    reportCardTemplateId: "rct-default",
    notifyOnPublish: true,
    createdBy: "Examination Controller",
    createdAt: daysAgoIso(60),
    updatedAt: daysAgoIso(30),
  },
  {
    id: "exam-halfyearly",
    name: "Half Yearly Examination",
    code: "HY-2627",
    type: "half-yearly",
    session: CURRENT_SESSION,
    branchId: "main",
    term: "Term 1",
    description: "Comprehensive half-yearly assessment across all core and elective subjects.",
    startDate: daysAgoIso(10).slice(0, 10),
    endDate: daysAgoIso(5).slice(0, 10),
    resultDate: daysFromNowIso(5).slice(0, 10),
    status: "verification",
    scope: "internal",
    mode: "offline",
    classIds: [class10.id],
    gradingSchemeId: "gs-cbse",
    resultRuleId: "rr-standard",
    reportCardTemplateId: "rct-default",
    notifyOnPublish: true,
    createdBy: "Examination Controller",
    createdAt: daysAgoIso(30),
    updatedAt: daysAgoIso(4),
  },
  {
    id: "exam-monthly3",
    name: "Monthly Test 3 — Core Subjects",
    code: "MT3-2627",
    type: "monthly-test",
    session: CURRENT_SESSION,
    branchId: "main",
    term: "Term 2",
    startDate: daysFromNowIso(9).slice(0, 10),
    endDate: daysFromNowIso(9).slice(0, 10),
    status: "scheduled",
    scope: "internal",
    mode: "offline",
    classIds: [class3.id],
    gradingSchemeId: "gs-primary",
    resultRuleId: "rr-primary",
    reportCardTemplateId: "rct-default",
    notifyOnPublish: false,
    createdBy: "Academic Coordinator",
    createdAt: daysAgoIso(5),
    updatedAt: daysAgoIso(1),
  },
  {
    id: "exam-preboard1",
    name: "Pre-Board Examination 1",
    code: "PB1-2627",
    type: "pre-board",
    session: CURRENT_SESSION,
    branchId: "main",
    term: "Term 2",
    startDate: daysFromNowIso(25).slice(0, 10),
    endDate: daysFromNowIso(30).slice(0, 10),
    status: "draft",
    scope: "internal",
    mode: "offline",
    classIds: [class10.id],
    notifyOnPublish: true,
    createdBy: "Examination Controller",
    createdAt: daysAgoIso(2),
    updatedAt: daysAgoIso(2),
  },
];

export const examClasses: ExamClass[] = [];
export const examSubjects: ExamSubject[] = [];

for (const exam of exams) {
  if (exam.id === "exam-preboard1") continue; // draft — subjects not configured yet, deliberately
  const pairs = exam.classIds.flatMap((classId) => {
    const schoolClass = schoolClasses.find((c) => c.id === classId)!;
    return schoolClass.sections.map((section) => ({ classId, sectionId: section.id }));
  });
  pairs.forEach(({ classId, sectionId }, sectionOrdinal) => {
    examClasses.push({ id: `ec-${exam.id}-${sectionId}`, examId: exam.id, classId, sectionId, excludedStudentIds: [] });
    examSubjects.push(...buildExamSubjects(exam.id, classId, sectionId, sectionOrdinal, pairs.length, new Date(exam.startDate), exam.status !== "draft"));
  });
}

export function examSubjectsFor(examId: string): ExamSubject[] {
  return examSubjects.filter((s) => s.examId === examId);
}

// --- Per-student data (attendance, marks, verification, results, report cards) ---
// Generated from the real student roster at store-build time, mirroring
// generateHomeworkSubmissions()'s pattern — students live in a separate seed
// module so this can't be a static top-level export.

type SeedStudent = { id: string; classId: string; sectionId: string; rollNumber?: string; profile: { firstName: string; lastName: string } };

export function generateExamStudentData(students: SeedStudent[]): {
  examAttendance: ExamAttendanceRecord[];
  studentMarks: StudentMark[];
  marksEntrySessions: MarksEntrySession[];
  marksVerifications: MarksVerification[];
  studentResults: StudentResult[];
  resultVersions: ResultVersion[];
  resultPublications: ResultPublication[];
  reportCards: ReportCard[];
  teacherRemarks: TeacherRemark[];
} {
  const examAttendance: ExamAttendanceRecord[] = [];
  const studentMarks: StudentMark[] = [];
  const marksEntrySessions: MarksEntrySession[] = [];
  const marksVerifications: MarksVerification[] = [];
  let studentResults: StudentResult[] = [];
  const resultVersions: ResultVersion[] = [];
  const resultPublications: ResultPublication[] = [];
  const reportCards: ReportCard[] = [];
  const teacherRemarks: TeacherRemark[] = [];

  // "locked": full pipeline complete (published exam) — entry locked, verification approved.
  // "submitted": fully entered and submitted, but not yet verified — what the marks-verification queue shows.
  // "partial": teacher is midway through entry — a genuine in-progress draft, nothing submitted yet.
  // "none": not started.
  function markSubject(examSubject: ExamSubject, sectionStudents: SeedStudent[], completion: "locked" | "submitted" | "partial" | "none") {
    const entrySessionId = `mes-${examSubject.id}`;
    let entered = 0;
    const fullyEnter = completion === "locked" || completion === "submitted";

    for (const student of sectionStudents) {
      const isAbsent = completion !== "none" && bool(0.04);
      examAttendance.push({
        id: `ea-${examSubject.id}-${student.id}`,
        examId: examSubject.examId,
        examSubjectId: examSubject.id,
        studentId: student.id,
        status: completion === "none" ? "not-marked" : isAbsent ? "absent" : "present",
        markedBy: completion === "none" ? undefined : "Examination Controller",
        markedAt: completion === "none" ? undefined : examSubject.date,
        locked: completion === "locked",
      });

      const shouldEnterMarks = fullyEnter || (completion === "partial" && bool(0.5));
      if (!shouldEnterMarks || isAbsent) continue;

      entered += 1;
      const performance = int(35, 97);
      const theory = examSubject.theoryMarks > 0 ? Math.round((examSubject.theoryMarks * performance) / 100) : undefined;
      const practical = examSubject.practicalMarks > 0 ? Math.round((examSubject.practicalMarks * int(60, 98)) / 100) : undefined;
      studentMarks.push({
        id: `sm-${examSubject.id}-${student.id}`,
        examId: examSubject.examId,
        examSubjectId: examSubject.id,
        studentId: student.id,
        theory,
        practical,
        graceApplied: 0,
        total: (theory ?? 0) + (practical ?? 0),
        enteredBy: examSubject.markEntryTeacherId,
        enteredAt: examSubject.date,
      });
    }

    const total = sectionStudents.length;
    const completionPercent = total > 0 ? Math.round((entered / total) * 100) : 0;
    marksEntrySessions.push({
      id: entrySessionId,
      examId: examSubject.examId,
      examSubjectId: examSubject.id,
      status: completion === "locked" ? "locked" : completion === "submitted" ? "submitted" : completion === "partial" && completionPercent > 0 ? "draft" : "not-started",
      completionPercent,
      lastSavedAt: completion === "none" ? undefined : examSubject.date,
      lastSavedBy: examSubject.markEntryTeacherId,
      submittedAt: fullyEnter ? examSubject.date : undefined,
      submittedBy: fullyEnter ? examSubject.markEntryTeacherId : undefined,
      lockedAt: completion === "locked" ? examSubject.date : undefined,
      lockedBy: completion === "locked" ? "Examination Controller" : undefined,
    });

    if (completion === "locked") {
      marksVerifications.push({
        id: `mv-${examSubject.id}`,
        examId: examSubject.examId,
        examSubjectId: examSubject.id,
        status: "approved",
        currentStage: "principal",
        history: [
          { id: `mva-${examSubject.id}-1`, stage: "subject-teacher", action: "submit", actorName: "Subject Teacher", actorRole: "Teacher", createdAt: examSubject.date ?? daysAgoIso(35) },
          { id: `mva-${examSubject.id}-2`, stage: "exam-controller", action: "verify", actorName: "Examination Controller", actorRole: "Examination Controller", createdAt: daysAgoIso(33) },
          { id: `mva-${examSubject.id}-3`, stage: "principal", action: "approve", actorName: "Principal", actorRole: "Principal", createdAt: daysAgoIso(31) },
        ],
      });
    } else if (completion === "submitted") {
      marksVerifications.push({
        id: `mv-${examSubject.id}`,
        examId: examSubject.examId,
        examSubjectId: examSubject.id,
        status: "submitted",
        currentStage: "exam-controller",
        history: [{ id: `mva-${examSubject.id}-1`, stage: "subject-teacher", action: "submit", actorName: "Subject Teacher", actorRole: "Teacher", createdAt: examSubject.date ?? daysAgoIso(6) }],
      });
    }
    // "partial"/"none" — nothing submitted yet, so no verification record exists until the teacher actually submits.
  }

  for (const exam of exams) {
    if (exam.status === "draft" || exam.status === "scheduled") continue;
    const isPublished = exam.status === "published";
    const examSectionIds = new Set(examSubjectsFor(exam.id).map((s) => s.sectionId));
    for (const sectionId of examSectionIds) {
      const sectionStudents = students.filter((s) => s.sectionId === sectionId);
      const sectionSubjects = examSubjectsFor(exam.id).filter((s) => s.sectionId === sectionId);
      sectionSubjects.forEach((examSubject, index) => {
        // In-progress exam: the first subject is fully entered and submitted (so the
        // verification queue has something real to review), the rest of the first half
        // are genuine in-progress drafts, and the second half haven't started — an
        // honest, varied "in progress" state rather than a single uniform completion %.
        const subjectCompletion: "locked" | "submitted" | "partial" | "none" = isPublished
          ? "locked"
          : index === 0
            ? "submitted"
            : index < sectionSubjects.length / 2
              ? "partial"
              : "none";
        markSubject(examSubject, sectionStudents, subjectCompletion);
      });
    }
  }

  // --- Results, publication, report cards — only for the fully-published exam ---
  const publishedExam = exams.find((e) => e.status === "published");
  if (publishedExam) {
    const scheme = gradingSchemes.find((g) => g.id === publishedExam.gradingSchemeId)!;
    const rule = resultRules.find((r) => r.id === publishedExam.resultRuleId)!;
    const examSectionIds = new Set(examSubjectsFor(publishedExam.id).map((s) => s.sectionId));
    const examStudents = students.filter((s) => examSectionIds.has(s.sectionId));

    const examSubjectsByClassSection = new Map<string, ExamSubject[]>();
    const marksByStudent = new Map<string, StudentMark[]>();
    const attendanceByStudent = new Map<string, ExamAttendanceRecord[]>();
    for (const student of examStudents) {
      const key = `${student.classId}::${student.sectionId}`;
      if (!examSubjectsByClassSection.has(key)) examSubjectsByClassSection.set(key, examSubjectsFor(publishedExam.id).filter((s) => s.sectionId === student.sectionId));
      marksByStudent.set(student.id, studentMarks.filter((m) => m.examId === publishedExam.id && m.studentId === student.id));
      attendanceByStudent.set(student.id, examAttendance.filter((a) => a.examId === publishedExam.id && a.studentId === student.id));
    }

    studentResults = calculateExamResults({
      examId: publishedExam.id,
      students: examStudents.map((s) => ({ id: s.id, classId: s.classId, sectionId: s.sectionId, name: `${s.profile.firstName} ${s.profile.lastName}` })),
      examSubjectsByClassSection,
      marksByStudent,
      attendanceByStudent,
      gradingScheme: scheme,
      resultRule: rule,
      calculationVersion: 1,
    });

    for (const result of studentResults) {
      resultVersions.push({
        id: `rv-${result.examId}-${result.studentId}-1`,
        examId: result.examId,
        studentId: result.studentId,
        version: 1,
        snapshot: result,
        reason: "Initial calculation",
        createdBy: "Examination Controller",
        createdAt: daysAgoIso(30),
      });
      reportCards.push({
        id: `rc-${result.examId}-${result.studentId}`,
        examId: result.examId,
        studentId: result.studentId,
        templateId: "rct-default",
        version: 1,
        status: "published",
        generatedAt: daysAgoIso(29),
        generatedBy: "Examination Controller",
        publishedAt: daysAgoIso(28),
      });
      if (bool(0.3)) {
        teacherRemarks.push({
          id: `tr-${result.examId}-${result.studentId}`,
          examId: result.examId,
          studentId: result.studentId,
          type: "class-teacher",
          text:
            result.status === "pass"
              ? "Consistent effort across subjects this term — keep up the steady progress."
              : "Needs focused revision in the subjects below the passing mark; please schedule a catch-up session.",
          aiGenerated: false,
          authorName: "Class Teacher",
          authorRole: "Teacher",
          createdAt: daysAgoIso(29),
          updatedAt: daysAgoIso(29),
        });
      }
    }

    resultPublications.push({
      id: `rp-${publishedExam.id}`,
      examId: publishedExam.id,
      scope: "all",
      status: "published",
      channels: ["parent-portal", "student-portal", "email"],
      publishedBy: "Principal",
      publishedAt: daysAgoIso(28),
    });
  }

  return { examAttendance, studentMarks, marksEntrySessions, marksVerifications, studentResults, resultVersions, resultPublications, reportCards, teacherRemarks };
}
