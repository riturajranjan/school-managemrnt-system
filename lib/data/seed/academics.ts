import type {
  AcademicEvent,
  CurriculumChapter,
  CurriculumTopic,
  CurriculumUnit,
  Homework,
  HomeworkSubmission,
  LessonPlan,
  ManagedClass,
  ProgressStatus,
  Room,
  StudentSupportAlert,
  Subject,
  SubjectAssignment,
  Teacher,
} from "@/lib/types/academics";
import { CURRENT_SESSION, schoolClasses } from "./reference";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(30082026);
const { pick, int, bool, daysAgoIso, daysFromNowIso } = helpers;

const teacherNames = [
  "Meera Krishnan", "Anil Deshpande", "Farah Sheikh", "Vikram Oberoi", "Priya Ramesh",
  "Suresh Pillai", "Kavita Nambiar", "Rajesh Khurana", "Neha Kulkarni", "Arjun Bhat",
  "Sunita Rao", "Deepak Menon", "Lakshmi Iyer", "Manoj Tiwari",
];

const departments = ["Sciences", "Mathematics", "Languages", "Humanities", "Arts & Sports"];

export const teachers: Teacher[] = teacherNames.map((name, index) => ({
  id: `teacher-${index + 1}`,
  name,
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@novyra.edu.in`,
  phone: `+91 9${String(800000000 + index * 731).slice(0, 9)}`,
  employeeId: `EMP-${2018 + (index % 6)}${String(100 + index)}`,
  department: departments[index % departments.length],
  subjectIds: [],
  joinDate: daysAgoIso(365 * (2 + (index % 6))),
  status: index === 11 ? "on-leave" : "active",
  maxWeeklyPeriods: 28,
}));

export const rooms: Room[] = [
  { id: "room-101", name: "Room 101", type: "classroom", capacity: 36 },
  { id: "room-102", name: "Room 102", type: "classroom", capacity: 36 },
  { id: "room-103", name: "Room 103", type: "classroom", capacity: 32 },
  { id: "room-201", name: "Room 201", type: "classroom", capacity: 32 },
  { id: "room-202", name: "Room 202", type: "classroom", capacity: 32 },
  { id: "lab-physics", name: "Physics Lab", type: "lab", capacity: 24 },
  { id: "lab-chem", name: "Chemistry Lab", type: "lab", capacity: 24 },
  { id: "lab-computer", name: "Computer Lab", type: "lab", capacity: 30 },
  { id: "hall-main", name: "Main Hall", type: "hall", capacity: 200 },
];

const subjectSeed: Array<Pick<Subject, "name" | "code" | "shortName" | "department" | "type" | "gradeRangeStart" | "gradeRangeEnd" | "color">> = [
  { name: "English", code: "ENG", shortName: "Eng", department: "Languages", type: "language", gradeRangeStart: 1, gradeRangeEnd: 13, color: "#087d95" },
  { name: "Mathematics", code: "MATH", shortName: "Math", department: "Mathematics", type: "core", gradeRangeStart: 1, gradeRangeEnd: 13, color: "#18b0c8" },
  { name: "Science", code: "SCI", shortName: "Sci", department: "Sciences", type: "core", gradeRangeStart: 4, gradeRangeEnd: 8, color: "#35c98d" },
  { name: "Physics", code: "PHY", shortName: "Phy", department: "Sciences", type: "practical", gradeRangeStart: 9, gradeRangeEnd: 13, color: "#4fd1e1" },
  { name: "Chemistry", code: "CHEM", shortName: "Chem", department: "Sciences", type: "practical", gradeRangeStart: 9, gradeRangeEnd: 13, color: "#2f7dd1" },
  { name: "Biology", code: "BIO", shortName: "Bio", department: "Sciences", type: "practical", gradeRangeStart: 9, gradeRangeEnd: 13, color: "#158a5f" },
  { name: "Social Studies", code: "SST", shortName: "SST", department: "Humanities", type: "core", gradeRangeStart: 4, gradeRangeEnd: 10, color: "#b5730b" },
  { name: "Hindi", code: "HIN", shortName: "Hindi", department: "Languages", type: "language", gradeRangeStart: 1, gradeRangeEnd: 10, color: "#d1403a" },
  { name: "Computer Science", code: "CS", shortName: "CS", department: "Sciences", type: "elective", gradeRangeStart: 6, gradeRangeEnd: 13, color: "#647784" },
  { name: "Environmental Studies", code: "EVS", shortName: "EVS", department: "Sciences", type: "core", gradeRangeStart: 1, gradeRangeEnd: 3, color: "#35c98d" },
  { name: "Art & Craft", code: "ART", shortName: "Art", department: "Arts & Sports", type: "co-curricular", gradeRangeStart: 1, gradeRangeEnd: 8, color: "#e2a53d" },
  { name: "Physical Education", code: "PE", shortName: "PE", department: "Arts & Sports", type: "co-curricular", gradeRangeStart: 1, gradeRangeEnd: 13, color: "#5ea2e8" },
];

export const subjects: Subject[] = subjectSeed.map((s) => ({
  id: `subject-${s.code.toLowerCase()}`,
  ...s,
  credit: s.type === "core" ? 4 : s.type === "language" ? 3 : 2,
  passingMarks: 33,
  maxMarks: 100,
  theoryMarks: s.type === "practical" ? 70 : 100,
  practicalMarks: s.type === "practical" ? 30 : 0,
  status: "active",
}));

export function subjectsForGrade(order: number): Subject[] {
  return subjects.filter((s) => order >= s.gradeRangeStart && order <= s.gradeRangeEnd);
}

// Assign 2-4 candidate teachers per subject (round-robin over the roster),
// then use those pools below so the same handful of teachers consistently
// own a subject across classes/sections, like a real staffing model would.
const teacherPoolBySubject = new Map<string, Teacher[]>();
subjects.forEach((subject, index) => {
  const pool = [teachers[index % teachers.length], teachers[(index + 3) % teachers.length], teachers[(index + 6) % teachers.length]];
  teacherPoolBySubject.set(subject.id, pool);
  for (const t of pool) if (!t.subjectIds.includes(subject.id)) t.subjectIds.push(subject.id);
});

export const subjectAssignments: SubjectAssignment[] = [];
for (const schoolClass of schoolClasses) {
  const applicable = subjectsForGrade(schoolClass.order);
  for (const section of schoolClass.sections) {
    for (const subject of applicable) {
      const pool = teacherPoolBySubject.get(subject.id)!;
      const primary = pick(pool);
      subjectAssignments.push({
        id: `sa-${section.id}-${subject.id}`,
        subjectId: subject.id,
        classId: schoolClass.id,
        sectionId: section.id,
        primaryTeacherId: primary.id,
        weeklyPeriods: subject.type === "core" ? 6 : subject.type === "language" ? 5 : 2,
        roomId: subject.type === "practical" ? (subject.code === "PHY" ? "lab-physics" : subject.code === "CHEM" ? "lab-chem" : "lab-computer") : undefined,
        session: CURRENT_SESSION,
      });
    }
  }
}

export const managedClasses: ManagedClass[] = schoolClasses.map((schoolClass, classIndex) => ({
  id: schoolClass.id,
  name: schoolClass.name,
  order: schoolClass.order,
  status: "active",
  sections: schoolClass.sections.map((section, sectionIndex) => ({
    id: section.id,
    classId: section.classId,
    name: section.name,
    capacity: section.capacity,
    enrolledCount: section.enrolledCount,
    classTeacherId: teachers[(classIndex * 3 + sectionIndex) % teachers.length].id,
    roomId: rooms[(classIndex + sectionIndex) % 5].id,
    shift: "morning",
  })),
}));

export function assignmentsForSection(sectionId: string): SubjectAssignment[] {
  return subjectAssignments.filter((a) => a.sectionId === sectionId);
}

export function teacherById(id: string | undefined): Teacher | undefined {
  return teachers.find((t) => t.id === id);
}

export function subjectById(id: string | undefined): Subject | undefined {
  return subjects.find((s) => s.id === id);
}

export function roomById(id: string | undefined): Room | undefined {
  return rooms.find((r) => r.id === id);
}

// --- Curriculum (bounded to a representative set of classes/subjects so the seed stays a demo-sized dataset, not a full syllabus). ---
const curriculumClassOrders = [3, 5, 7, 9, 11, 12];
const curriculumSubjectIds = ["subject-eng", "subject-math"];

const unitTitles = ["Foundations", "Core Concepts", "Applications", "Extended Practice", "Review & Synthesis"];
const statusPool: ProgressStatus[] = ["completed", "completed", "in-progress", "planned", "delayed", "not-started"];

export const curriculumUnits: CurriculumUnit[] = [];
for (const order of curriculumClassOrders) {
  const schoolClass = schoolClasses.find((c) => c.order === order);
  if (!schoolClass) continue;
  for (const subjectId of curriculumSubjectIds) {
    const subject = subjectById(subjectId);
    if (!subject || order < subject.gradeRangeStart || order > subject.gradeRangeEnd) continue;
    const pool = teacherPoolBySubject.get(subjectId)!;
    const teacher = pick(pool);

    unitTitles.forEach((title, unitIndex) => {
      const unitId = `unit-${schoolClass.id}-${subjectId}-${unitIndex}`;
      const status = statusPool[Math.min(unitIndex, statusPool.length - 1)];
      const chapters: CurriculumChapter[] = Array.from({ length: int(2, 3) }, (_, chapterIndex) => {
        const chapterId = `${unitId}-ch${chapterIndex}`;
        const chapterStatus: ProgressStatus = unitIndex === 0 ? "completed" : status;
        const topics: CurriculumTopic[] =
          unitIndex <= 1
            ? Array.from({ length: 2 }, (_, topicIndex) => ({
                id: `${chapterId}-t${topicIndex}`,
                chapterId,
                title: `${title} — Topic ${topicIndex + 1}`,
                sequence: topicIndex + 1,
                status: chapterStatus,
                learningOutcomes: [`Explain key idea ${topicIndex + 1} of ${title.toLowerCase()}`, "Apply the concept to a guided example"],
              }))
            : [];
        return {
          id: chapterId,
          unitId,
          title: `Chapter ${chapterIndex + 1}: ${title}`,
          sequence: chapterIndex + 1,
          status: chapterStatus,
          plannedStart: daysAgoIso(120 - unitIndex * 20),
          plannedEnd: daysAgoIso(100 - unitIndex * 20),
          actualCompletion: chapterStatus === "completed" ? daysAgoIso(95 - unitIndex * 20) : undefined,
          topics,
        };
      });

      const estimatedPeriods = chapters.length * 4;
      const completedPeriods = status === "completed" ? estimatedPeriods : status === "in-progress" ? Math.round(estimatedPeriods * 0.5) : status === "delayed" ? Math.round(estimatedPeriods * 0.3) : 0;

      curriculumUnits.push({
        id: unitId,
        subjectId,
        classId: schoolClass.id,
        session: CURRENT_SESSION,
        title,
        description: `${title} for ${subject.name} — ${schoolClass.name}`,
        sequence: unitIndex + 1,
        plannedStart: daysAgoIso(130 - unitIndex * 20),
        plannedEnd: daysAgoIso(95 - unitIndex * 20),
        actualCompletion: status === "completed" ? daysAgoIso(90 - unitIndex * 20) : undefined,
        teacherId: teacher.id,
        status,
        estimatedPeriods,
        completedPeriods,
        chapters,
      });
    });
  }
}

export function curriculumUnitsFor(classId: string, subjectId: string): CurriculumUnit[] {
  return curriculumUnits.filter((u) => u.classId === classId && u.subjectId === subjectId);
}

// --- Lesson plans: last 2 weeks + next few days, for every teacher's assignments. ---
const lessonStatusPool: LessonPlan["status"][] = ["completed", "completed", "completed", "approved", "submitted", "draft"];

export const lessonPlans: LessonPlan[] = [];
{
  let seq = 0;
  for (const assignment of subjectAssignments) {
    if (!bool(0.55)) continue; // not every assignment has a recent lesson plan seeded — realistic gaps
    const daysBack = int(-3, 12);
    const status: LessonPlan["status"] = daysBack < 0 ? pick(["scheduled", "draft"]) : pick(lessonStatusPool);
    seq += 1;
    lessonPlans.push({
      id: `lp-${seq}`,
      teacherId: assignment.primaryTeacherId,
      classId: assignment.classId,
      sectionId: assignment.sectionId,
      subjectId: assignment.subjectId,
      date: daysAgoIso(daysBack),
      period: int(1, 8),
      learningObjective: `Students will understand the key concepts for today's ${subjectById(assignment.subjectId)?.name} session.`,
      teachingMethod: pick(["Lecture + discussion", "Group activity", "Lab demonstration", "Flipped classroom", "Peer teaching"]),
      materials: pick(["Textbook, whiteboard", "Worksheet handouts", "Lab equipment", "Projector slides", "Manipulatives"]),
      activity: "Guided practice followed by independent exercises and a short recap quiz.",
      homework: bool(0.6) ? "Complete the practice worksheet for the next class." : undefined,
      assessmentMethod: pick(["Oral questioning", "Exit ticket", "Worksheet review", "Quiz"]),
      status,
      reviewComment: status === "rejected" ? "Please align this plan with the current curriculum chapter." : undefined,
      attachments: [],
      createdAt: daysAgoIso(daysBack + 1),
      updatedAt: daysAgoIso(daysBack),
    });
  }
}

// --- Homework + submissions ---
const homeworkTitles = ["Chapter review worksheet", "Practice problem set", "Reading comprehension task", "Project milestone", "Revision assignment"];

export const homeworkList: Homework[] = [];
export const homeworkSubmissions: HomeworkSubmission[] = [];
{
  let seq = 0;
  for (const assignment of subjectAssignments) {
    if (!bool(0.4)) continue;
    seq += 1;
    const daysAssignedAgo = int(-2, 10);
    const dueInDays = int(2, 7);
    const status: Homework["status"] = daysAssignedAgo < 0 ? "scheduled" : pick(["published", "published", "due-soon", "overdue", "evaluated", "closed"]);
    const homeworkId = `hw-${seq}`;
    homeworkList.push({
      id: homeworkId,
      title: `${pick(homeworkTitles)} — ${subjectById(assignment.subjectId)?.name}`,
      description: "Complete all questions and show your working where applicable.",
      classId: assignment.classId,
      sectionId: assignment.sectionId,
      subjectId: assignment.subjectId,
      teacherId: assignment.primaryTeacherId,
      assignedDate: daysAgoIso(daysAssignedAgo),
      dueDate: daysAgoIso(daysAssignedAgo - dueInDays),
      maxMarks: 10,
      instructions: "Submit through the portal or hand in a physical copy in class.",
      submissionType: pick(["file", "text", "offline", "image"]),
      allowLateSubmission: bool(0.7),
      requireParentAcknowledgement: bool(0.4),
      visibility: "section",
      status,
      createdAt: daysAgoIso(daysAssignedAgo + 1),
      updatedAt: daysAgoIso(Math.max(0, daysAssignedAgo - 1)),
    });
  }
}

// Submissions depend on the real student roster (for section membership),
// which lives in a separate seed module — generated by the store at seed
// time via this helper rather than importing generateStudents() here and
// paying for (and risking drift from) a second independent generation pass.
export function generateHomeworkSubmissions(
  students: { id: string; sectionId: string }[],
  homework: Homework[],
): HomeworkSubmission[] {
  const submissions: HomeworkSubmission[] = [];
  for (const hw of homework) {
    if (hw.status === "draft" || hw.status === "scheduled") continue;
    const sectionStudents = students.filter((s) => s.sectionId === hw.sectionId);
    let seq = 0;
    for (const student of sectionStudents) {
      seq += 1;
      const roll = int(0, 99);
      let status: HomeworkSubmission["status"];
      if (hw.status === "evaluated") status = roll < 85 ? "evaluated" : "needs-resubmission";
      else if (hw.status === "overdue") status = roll < 55 ? "late" : roll < 75 ? "submitted" : "not-submitted";
      else status = roll < 60 ? "submitted" : roll < 75 ? "late" : "not-submitted";

      submissions.push({
        id: `${hw.id}-sub-${seq}`,
        homeworkId: hw.id,
        studentId: student.id,
        submittedAt: status === "not-submitted" ? undefined : daysAgoIso(int(0, 5)),
        fileNames: status === "not-submitted" ? [] : [`${hw.title.toLowerCase().replace(/\s+/g, "-")}.pdf`],
        status,
        marksObtained: status === "evaluated" ? int(Math.round(hw.maxMarks * 0.4), hw.maxMarks) : undefined,
        feedback: status === "evaluated" && bool(0.5) ? "Good effort — review the third question." : undefined,
        acknowledgedByParent: hw.requireParentAcknowledgement ? bool(0.6) : false,
      });
    }
  }
  return submissions;
}

// Derived from each student's existing risk signals (Phase 2 data) rather
// than invented separately, so an alert here always traces back to a real
// attendance/fee/behaviour/academic fact already on the student record.
export function generateStudentSupportAlerts(
  students: {
    id: string;
    attendance: { presentPercent: number };
    fees: { status: string };
    academics: { subjectsAtRisk: string[] };
    behaviourNotes: { type: string; title: string }[];
  }[],
): StudentSupportAlert[] {
  const alerts: StudentSupportAlert[] = [];
  let seq = 0;
  for (const student of students) {
    if (student.attendance.presentPercent < 75) {
      seq += 1;
      alerts.push({
        id: `alert-${seq}`,
        studentId: student.id,
        type: "attendance",
        severity: student.attendance.presentPercent < 60 ? "high" : "medium",
        detail: `Attendance at ${student.attendance.presentPercent}% — below the eligibility threshold.`,
        createdAt: daysAgoIso(int(0, 10)),
        resolved: false,
      });
    }
    if (student.academics.subjectsAtRisk.length > 0) {
      seq += 1;
      alerts.push({
        id: `alert-${seq}`,
        studentId: student.id,
        type: "performance",
        severity: "medium",
        detail: `Falling behind in ${student.academics.subjectsAtRisk.join(", ")}.`,
        createdAt: daysAgoIso(int(0, 14)),
        resolved: false,
      });
    }
    if (student.behaviourNotes.some((n) => n.type === "incident" || n.type === "concern")) {
      seq += 1;
      const note = student.behaviourNotes.find((n) => n.type === "incident" || n.type === "concern")!;
      alerts.push({
        id: `alert-${seq}`,
        studentId: student.id,
        type: "behaviour",
        severity: note.type === "incident" ? "high" : "low",
        detail: note.title,
        createdAt: daysAgoIso(int(0, 20)),
        resolved: bool(0.3),
      });
    }
  }
  return alerts;
}

export const academicEvents: AcademicEvent[] = [
  { id: "evt-1", title: "Republic Day Holiday", type: "holiday", startDate: daysFromNowIso(3), allDay: true, audience: ["all"], createdBy: "Administrator" },
  { id: "evt-2", title: "Term 2 Unit Test — Mathematics", type: "exam", startDate: daysFromNowIso(9), allDay: false, audience: ["students", "teachers"], createdBy: "Academic Coordinator" },
  { id: "evt-3", title: "Parent-Teacher Meeting — Classes 6-8", type: "ptm", startDate: daysFromNowIso(14), allDay: false, audience: ["teachers", "parents"], createdBy: "Principal" },
  { id: "evt-4", title: "Annual Sports Day", type: "sports", startDate: daysFromNowIso(21), allDay: true, audience: ["all"], createdBy: "Administrator" },
  { id: "evt-5", title: "Curriculum planning deadline — Term 3", type: "deadline", startDate: daysFromNowIso(6), allDay: false, audience: ["teachers"], createdBy: "Academic Coordinator" },
  { id: "evt-6", title: "New teacher orientation", type: "training", startDate: daysFromNowIso(-2), allDay: false, audience: ["teachers", "staff"], createdBy: "Principal" },
  { id: "evt-7", title: "Inter-house Art Exhibition", type: "activity", startDate: daysFromNowIso(17), allDay: true, audience: ["all"], createdBy: "Administrator" },
  { id: "evt-8", title: "Admission counselling window opens", type: "admissions", startDate: daysFromNowIso(25), allDay: true, audience: ["staff"], createdBy: "Admission Officer" },
];
