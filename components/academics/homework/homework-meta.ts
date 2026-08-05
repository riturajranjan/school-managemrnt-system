import type { SubmissionType } from "@/lib/types/academics";

export const submissionTypeLabels: Record<SubmissionType, string> = {
  offline: "Offline",
  text: "Text answer",
  file: "File upload",
  image: "Image upload",
  link: "Link",
  quiz: "Quiz",
  mixed: "Mixed",
};
