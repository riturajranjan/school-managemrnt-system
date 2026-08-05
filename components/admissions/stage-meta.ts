import type { AdmissionStageKey } from "@/lib/types/admissions";
import type { StatusTone } from "@/lib/types/common";

export const stageTone: Record<AdmissionStageKey, StatusTone> = {
  "new-enquiry": "neutral",
  "application-started": "info",
  "documents-pending": "warning",
  "under-review": "info",
  "interview-scheduled": "info",
  approved: "success",
  "fee-pending": "warning",
  enrolled: "success",
  rejected: "error",
  waitlisted: "warning",
};
