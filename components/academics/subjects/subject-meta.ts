import type { StatusTone } from "@/lib/types/common";
import type { SubjectType } from "@/lib/types/academics";

export const subjectTypeLabels: Record<SubjectType, string> = {
  core: "Core",
  elective: "Elective",
  optional: "Optional",
  practical: "Practical",
  language: "Language",
  "co-curricular": "Co-curricular",
};

export const subjectTypeTone: Record<SubjectType, StatusTone> = {
  core: "info",
  elective: "success",
  optional: "neutral",
  practical: "warning",
  language: "info",
  "co-curricular": "neutral",
};
