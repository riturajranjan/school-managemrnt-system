import type { DocumentStatus, StatusTone } from "@/lib/types/common";

export const documentStatusTone: Record<DocumentStatus, StatusTone> = {
  missing: "neutral",
  uploaded: "info",
  "under-review": "warning",
  approved: "success",
  rejected: "error",
  expired: "error",
  "re-upload-requested": "warning",
};
