import type { ID } from "./common";

export type PromotionDecisionType = "promote" | "retain" | "conditional-promotion" | "transfer" | "graduate" | "withdraw" | "pending";

export const promotionDecisionLabels: Record<PromotionDecisionType, string> = {
  promote: "Promote",
  retain: "Retain",
  "conditional-promotion": "Conditional promotion",
  transfer: "Transfer",
  graduate: "Graduate",
  withdraw: "Withdraw",
  pending: "Pending decision",
};

export type PromotionRule = {
  id: ID;
  name: string;
  session: string;
  /** Undefined = applies to every class. */
  classId?: ID;
  minOverallPercent?: number;
  maxFailedSubjects: number;
  minAttendancePercent?: number;
  allowSupplementaryResult: boolean;
  requirePrincipalApproval: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PromotionDecision = {
  id: ID;
  runId: ID;
  studentId: ID;
  fromClassId: ID;
  fromSectionId: ID;
  toClassId?: ID;
  toSectionId?: ID;
  newRollNumber?: string;
  decision: PromotionDecisionType;
  /** The decision computed by the eligibility engine when the run was created — compared
   * against `decision` to detect and surface a manual override. */
  originalDecision: PromotionDecisionType;
  reason?: string;
  overriddenBy?: string;
  overrideReason?: string;
  approvedBy?: string;
};

export type PromotionRunStatus = "draft" | "reviewing" | "confirmed" | "completed" | "rolled-back";

export const promotionRunStatusLabels: Record<PromotionRunStatus, string> = {
  draft: "Draft",
  reviewing: "Reviewing",
  confirmed: "Confirmed",
  completed: "Completed",
  "rolled-back": "Rolled back",
};

export type PromotionRun = {
  id: ID;
  fromSession: string;
  toSession: string;
  classId: ID;
  ruleId?: ID;
  status: PromotionRunStatus;
  decisions: PromotionDecision[];
  createdBy: string;
  createdAt: string;
  confirmedBy?: string;
  confirmedAt?: string;
};
