import type { StatusTone } from "@/lib/types/common";
import type { ParentPortalStatus } from "@/lib/types/students";

export const portalStatusTone: Record<ParentPortalStatus, StatusTone> = {
  "not-invited": "neutral",
  invited: "info",
  active: "success",
  suspended: "error",
};

export const portalStatusLabels: Record<ParentPortalStatus, string> = {
  "not-invited": "Not invited",
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
};
