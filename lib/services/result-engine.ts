import type { ExamAttendanceRecord, ExamSubject } from "@/lib/types/exams";
import type { GradeRange, GradingScheme, ResultRule } from "@/lib/types/grading";
import type { StudentMark } from "@/lib/types/marks";
import type { OverallResultStatus, ResultDivision, StudentResult, SubjectResult } from "@/lib/types/results";
import { generateId } from "@/lib/utils";

// Pure, deterministic result calculation — no store access, no UI concerns.
// Every function here takes its inputs explicitly and returns a value; nothing
// is mutated or persisted. The service layer (exam-result-service.ts) is
// responsible for calling this and committing the output to the store, and
// for archiving the previous StudentResult into a ResultVersion first.

export function gradeForPercent(ranges: GradeRange[], percent: number): GradeRange | undefined {
  return ranges.find((r) => percent >= r.minPercent && percent <= r.maxPercent);
}

/** Returns one description per overlapping pair — empty array means the scheme is valid. */
export function validateGradeRanges(ranges: GradeRange[]): string[] {
  const errors: string[] = [];
  const sorted = [...ranges].sort((a, b) => a.minPercent - b.minPercent);
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    if (r.minPercent > r.maxPercent) errors.push(`"${r.name}": minimum (${r.minPercent}) is above maximum (${r.maxPercent}).`);
    const next = sorted[i + 1];
    if (next && r.maxPercent >= next.minPercent) {
      errors.push(`"${r.name}" (${r.minPercent}-${r.maxPercent}) overlaps "${next.name}" (${next.minPercent}-${next.maxPercent}).`);
    }
  }
  return errors;
}

function round(value: number, rule: ResultRule): number {
  const factor = 10 ** rule.decimalPrecision;
  const scaled = value * factor;
  const rounded = rule.roundingRule === "up" ? Math.ceil(scaled) : rule.roundingRule === "down" ? Math.floor(scaled) : rule.roundingRule === "none" ? scaled : Math.round(scaled);
  return rounded / factor;
}

const ATTENDED_STATUSES = new Set(["present", "late", "medical"]);
const VOID_STATUSES = new Set(["malpractice", "withheld"]);

export type StudentResultCalcInput = {
  studentId: string;
  classId: string;
  sectionId: string;
  examSubjects: ExamSubject[];
  marks: StudentMark[];
  attendance: ExamAttendanceRecord[];
  gradingScheme: GradingScheme;
  resultRule: ResultRule;
  calculationVersion: number;
};

export type StudentResultCalcOutput = Omit<StudentResult, "id" | "examId" | "rank" | "eligibleForRank">;

export function calculateStudentResult(input: StudentResultCalcInput): StudentResultCalcOutput {
  const { examSubjects, marks, attendance, gradingScheme, resultRule } = input;
  const explanation: string[] = [];
  let graceRemaining = resultRule.graceMarksLimit;

  const subjectResults: SubjectResult[] = examSubjects.map((subject) => {
    const mark = marks.find((m) => m.examSubjectId === subject.id);
    const att = attendance.find((a) => a.examSubjectId === subject.id);
    const attStatus = att?.status ?? "not-marked";

    if (VOID_STATUSES.has(attStatus)) {
      return {
        examSubjectId: subject.id,
        subjectId: subject.subjectId,
        graceApplied: 0,
        total: 0,
        maxMarks: subject.maxMarks,
        percent: 0,
        grade: "—",
        status: "withheld",
      };
    }

    if (attStatus === "absent") {
      return {
        examSubjectId: subject.id,
        subjectId: subject.subjectId,
        graceApplied: 0,
        total: 0,
        maxMarks: subject.maxMarks,
        percent: 0,
        grade: "—",
        status: "absent",
      };
    }

    if (attStatus === "exempted") {
      return {
        examSubjectId: subject.id,
        subjectId: subject.subjectId,
        graceApplied: 0,
        total: 0,
        maxMarks: subject.maxMarks,
        percent: 0,
        grade: "EX",
        status: "exempted",
      };
    }

    const theory = mark?.theory ?? 0;
    const practical = mark?.practical ?? 0;
    const internal = mark?.internal ?? 0;
    const project = mark?.project ?? 0;
    let total = theory + practical + internal + project;
    let graceApplied = 0;

    const subjectPercent = subject.maxMarks > 0 ? (total / subject.maxMarks) * 100 : 0;
    const meetsComponentMinimums =
      (!resultRule.minTheoryPercent || subject.theoryMarks === 0 || (theory / subject.theoryMarks) * 100 >= resultRule.minTheoryPercent) &&
      (!resultRule.minPracticalPercent || subject.practicalMarks === 0 || (practical / subject.practicalMarks) * 100 >= resultRule.minPracticalPercent) &&
      (!resultRule.minMarksPerSubjectPercent || subjectPercent >= resultRule.minMarksPerSubjectPercent);

    let passes = total >= subject.passingMarks && meetsComponentMinimums;

    if (!passes && graceRemaining > 0) {
      const gap = subject.passingMarks - total;
      const capped = Math.min(subject.graceMarksLimit, graceRemaining);
      if (gap > 0 && gap <= capped && meetsComponentMinimums) {
        graceApplied = gap;
        total += gap;
        graceRemaining -= gap;
        passes = true;
        explanation.push(`Grace marks applied: +${gap} in this subject (within the ${subject.graceMarksLimit}-mark subject limit).`);
      }
    }

    const percent = subject.maxMarks > 0 ? (total / subject.maxMarks) * 100 : 0;
    const range = gradeForPercent(gradingScheme.ranges, percent);

    return {
      examSubjectId: subject.id,
      subjectId: subject.subjectId,
      theory: mark?.theory,
      practical: mark?.practical,
      internal: mark?.internal,
      project: mark?.project,
      graceApplied,
      total,
      maxMarks: subject.maxMarks,
      percent: round(percent, resultRule),
      grade: range?.name ?? "—",
      gradePoint: range?.gradePoint,
      status: passes ? "pass" : "fail",
    };
  });

  const countableSubjects = subjectResults.filter((s) => s.status !== "exempted");
  const totalObtained = countableSubjects.reduce((sum, s) => sum + s.total, 0);
  const totalMax = countableSubjects.reduce((sum, s) => sum + s.maxMarks, 0);
  const percent = totalMax > 0 ? round((totalObtained / totalMax) * 100, resultRule) : 0;
  const overallRange = gradeForPercent(gradingScheme.ranges, percent);
  const failedSubjectCount = subjectResults.filter((s) => s.status === "fail").length;
  const withheldCount = subjectResults.filter((s) => s.status === "withheld").length;
  const absentCount = subjectResults.filter((s) => s.status === "absent").length;

  const attendedCount = examSubjects.filter((s) => {
    const att = attendance.find((a) => a.examSubjectId === s.id);
    return att && ATTENDED_STATUSES.has(att.status);
  }).length;
  const attendancePercent = examSubjects.length > 0 ? round((attendedCount / examSubjects.length) * 100, resultRule) : 0;

  let status: OverallResultStatus;
  if (withheldCount > 0) {
    status = "withheld";
    explanation.push("Withheld: at least one subject was marked malpractice/withheld.");
  } else if (absentCount === subjectResults.length && subjectResults.length > 0) {
    status = "absent";
  } else if (resultRule.attendanceEligibilityPercent && attendancePercent < resultRule.attendanceEligibilityPercent) {
    status = "re-exam-required";
    explanation.push(`Exam attendance ${attendancePercent}% is below the ${resultRule.attendanceEligibilityPercent}% eligibility threshold.`);
  } else if (failedSubjectCount > resultRule.maxFailedSubjects) {
    status = "fail";
    explanation.push(`Failed ${failedSubjectCount} subject(s), exceeding the allowed limit of ${resultRule.maxFailedSubjects}.`);
  } else if (resultRule.minOverallPercent && percent < resultRule.minOverallPercent) {
    status = "fail";
    explanation.push(`Overall ${percent}% is below the required minimum of ${resultRule.minOverallPercent}%.`);
  } else {
    status = "pass";
    if (failedSubjectCount > 0) explanation.push(`${failedSubjectCount} subject(s) below passing, within the allowed limit of ${resultRule.maxFailedSubjects}.`);
  }

  const division: ResultDivision | undefined =
    status !== "pass" ? "none" : percent >= 75 ? "distinction" : percent >= 60 ? "first" : percent >= 45 ? "second" : percent >= 33 ? "third" : "none";

  const gradePoints = subjectResults.map((s) => s.gradePoint).filter((g): g is number => g !== undefined);
  const gpa = gradePoints.length > 0 ? round(gradePoints.reduce((sum, g) => sum + g, 0) / gradePoints.length, resultRule) : undefined;

  return {
    studentId: input.studentId,
    classId: input.classId,
    sectionId: input.sectionId,
    subjectResults,
    totalObtained,
    totalMax,
    percent,
    grade: overallRange?.name ?? "—",
    gpa,
    division,
    status,
    failedSubjectCount,
    attendancePercent,
    calculationVersion: input.calculationVersion,
    calculatedAt: new Date().toISOString(),
    appliedRuleId: resultRule.id,
    explanation,
  };
}

/** Assigns ranks within each class+section group, honoring rankInclusion and the configured tie-breaker. Mutates nothing — returns a new array. */
export function assignRanks(results: StudentResult[], rule: ResultRule, studentNameById: Map<string, string>): StudentResult[] {
  const groups = new Map<string, StudentResult[]>();
  for (const result of results) {
    const key = `${result.classId}::${result.sectionId}`;
    const group = groups.get(key) ?? [];
    group.push(result);
    groups.set(key, group);
  }

  const output: StudentResult[] = [];
  for (const group of groups.values()) {
    const eligible = group.filter((r) => {
      if (r.status === "withheld" || r.status === "absent") return false;
      if (rule.rankInclusion === "pass-only" && r.status !== "pass") return false;
      return true;
    });

    const sorted = [...eligible].sort((a, b) => {
      if (b.percent !== a.percent) return b.percent - a.percent;
      if (rule.tieBreaker === "higher-theory" || rule.tieBreaker === "higher-practical") {
        const key: "theory" | "practical" = rule.tieBreaker === "higher-theory" ? "theory" : "practical";
        const aSum = a.subjectResults.reduce((sum, s) => sum + (s[key] ?? 0), 0);
        const bSum = b.subjectResults.reduce((sum, s) => sum + (s[key] ?? 0), 0);
        if (bSum !== aSum) return bSum - aSum;
      }
      if (rule.tieBreaker === "alphabetical") {
        return (studentNameById.get(a.studentId) ?? "").localeCompare(studentNameById.get(b.studentId) ?? "");
      }
      return 0;
    });

    let rank = 0;
    let lastPercent: number | null = null;
    let position = 0;
    for (const result of sorted) {
      position += 1;
      if (rule.tieBreaker === "none" && result.percent === lastPercent) {
        // share the previous rank
      } else {
        rank = position;
      }
      lastPercent = result.percent;
      output.push({ ...result, rank, eligibleForRank: true });
    }

    for (const result of group) {
      if (!eligible.includes(result)) output.push({ ...result, rank: undefined, eligibleForRank: false });
    }
  }
  return output;
}

/** Orchestrates calculation + ranking for a whole exam and stamps IDs — still pure, still nothing persisted. */
export function calculateExamResults(params: {
  examId: string;
  students: { id: string; classId: string; sectionId: string; name: string }[];
  examSubjectsByClassSection: Map<string, ExamSubject[]>;
  marksByStudent: Map<string, StudentMark[]>;
  attendanceByStudent: Map<string, ExamAttendanceRecord[]>;
  gradingScheme: GradingScheme;
  resultRule: ResultRule;
  calculationVersion: number;
}): StudentResult[] {
  const { examId, students, examSubjectsByClassSection, marksByStudent, attendanceByStudent, gradingScheme, resultRule, calculationVersion } = params;

  const raw: StudentResult[] = students.map((student) => {
    const key = `${student.classId}::${student.sectionId}`;
    const examSubjects = examSubjectsByClassSection.get(key) ?? [];
    const calc = calculateStudentResult({
      studentId: student.id,
      classId: student.classId,
      sectionId: student.sectionId,
      examSubjects,
      marks: marksByStudent.get(student.id) ?? [],
      attendance: attendanceByStudent.get(student.id) ?? [],
      gradingScheme,
      resultRule,
      calculationVersion,
    });
    return { id: generateId("result"), examId, rank: undefined, eligibleForRank: false, ...calc };
  });

  const studentNameById = new Map(students.map((s) => [s.id, s.name]));
  return assignRanks(raw, resultRule, studentNameById);
}
