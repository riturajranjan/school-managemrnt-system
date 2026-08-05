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
