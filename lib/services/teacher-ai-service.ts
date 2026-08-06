// Deterministic, template-based "AI assistant" mocks (no external model call
// in this build) — mirrors the approach in lesson-plan-service.ts's
// generateAiLessonPlanDraft. All output is plain text a teacher edits before
// using; nothing here writes to a record automatically.

export function draftParentMessage(studentName: string, topic: "attendance" | "homework" | "behaviour" | "general", detail: string): string {
  const openers: Record<typeof topic, string> = {
    attendance: `I wanted to reach out regarding ${studentName}'s attendance.`,
    homework: `I wanted to update you on ${studentName}'s homework.`,
    behaviour: `I wanted to share an observation about ${studentName} in class.`,
    general: `I wanted to share a quick update about ${studentName}.`,
  };
  return `${openers[topic]} ${detail} Please let me know if you'd like to discuss this further — happy to schedule a call this week.\n\nBest regards,\nClass Teacher`;
}

export function summarizeClassPerformance(sectionName: string, averagePercent: number, atRiskCount: number): string {
  const tone = averagePercent >= 75 ? "performing well overall" : averagePercent >= 60 ? "performing steadily, with room to improve" : "showing signs of falling behind and needs attention";
  return `Section ${sectionName} is ${tone}, with an average of ${averagePercent}%. ${atRiskCount > 0 ? `${atRiskCount} student(s) currently need closer support.` : "No students are currently flagged as at-risk."}`;
}

export function generateRevisionActivity(subjectName: string, topic: string): string {
  return `Quick revision activity for ${subjectName} — ${topic}: Split the class into pairs. Each pair writes 2 quiz questions on ${topic}, then swaps with another pair to answer. Review the trickiest questions as a class in the last 5 minutes.`;
}

export function generateQuizQuestions(subjectName: string, topic: string): string[] {
  return [
    `Define the key term associated with ${topic} in ${subjectName}.`,
    `Explain, in your own words, why ${topic} matters in ${subjectName}.`,
    `Give one real-world example that demonstrates ${topic}.`,
    `Solve a short problem applying ${topic}.`,
  ];
}

export function draftReportCardRemark(studentName: string, strength: string, growthArea: string): string {
  return `${studentName} has shown strong engagement in ${strength} this term. To continue growing, focus on ${growthArea} — with consistent practice, steady improvement is expected next term.`;
}

export type RemarkSuggestionInput = {
  studentName: string;
  percent: number;
  attendancePercent: number;
  failedSubjectCount: number;
  strongestSubject?: string;
  weakestSubject?: string;
  percentDeltaVsPrevious?: number;
};

export type RemarkSuggestion = { text: string; influencedBy: string[] };

/** Same deterministic, template-based mock as the rest of this file — never calls an
 * external model. Every fact used is named in influencedBy so the reviewing teacher can
 * see exactly what shaped the suggestion, and the tone stays constructive regardless of
 * performance (no negative or humiliating language, no unsupported diagnoses). */
export function generateRemarkSuggestion(input: RemarkSuggestionInput): RemarkSuggestion {
  const influencedBy: string[] = [`Overall result: ${input.percent}%`];
  const sentences: string[] = [];

  if (input.percent >= 85) sentences.push(`${input.studentName} has delivered an excellent result this term, reflecting consistent effort across subjects.`);
  else if (input.percent >= 60) sentences.push(`${input.studentName} has turned in a solid result this term.`);
  else if (input.failedSubjectCount > 0) sentences.push(`${input.studentName} is finding some subjects challenging this term and would benefit from focused support.`);
  else sentences.push(`${input.studentName} has completed this term's assessment; there is room to build further on the fundamentals.`);

  if (input.strongestSubject) {
    sentences.push(`${input.strongestSubject} stands out as a particular strength.`);
    influencedBy.push(`Strongest subject: ${input.strongestSubject}`);
  }
  if (input.failedSubjectCount > 0 && input.weakestSubject) {
    sentences.push(`Extra practice in ${input.weakestSubject} would help close the gap.`);
    influencedBy.push(`${input.failedSubjectCount} subject(s) below passing, weakest: ${input.weakestSubject}`);
  }
  if (input.percentDeltaVsPrevious !== undefined) {
    if (input.percentDeltaVsPrevious > 2) {
      sentences.push(`This is a ${Math.round(input.percentDeltaVsPrevious)}-point improvement over the previous exam — encouraging progress.`);
      influencedBy.push(`+${Math.round(input.percentDeltaVsPrevious)}% vs previous exam`);
    } else if (input.percentDeltaVsPrevious < -2) {
      sentences.push(`This is a step down from the previous exam, worth a conversation about what changed.`);
      influencedBy.push(`${Math.round(input.percentDeltaVsPrevious)}% vs previous exam`);
    }
  }
  if (input.attendancePercent < 75) {
    sentences.push(`Attendance at ${input.attendancePercent}% for this exam is worth addressing, as it may be affecting performance.`);
    influencedBy.push(`Exam attendance: ${input.attendancePercent}%`);
  }

  return { text: sentences.join(" "), influencedBy };
}
