import type { StatusTone } from "@/lib/types/common";
import type { StudentFeeStatus, StudentStatus } from "@/lib/types/students";

export const studentStatusTone: Record<StudentStatus, StatusTone> = {
  active: "success",
  inactive: "neutral",
  alumni: "info",
  transferred: "warning",
  archived: "neutral",
};

export const feeStatusTone: Record<StudentFeeStatus, StatusTone> = {
  paid: "success",
  partial: "warning",
  pending: "neutral",
  overdue: "error",
};
