import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { approveLeave, cancelLeave, rejectLeave, submitLeaveRequest } from "./leave-service";

function baseLeaveInput() {
  return {
    applicantType: "staff" as const,
    applicantId: "teacher-2",
    applicantName: "Anil Deshpande",
    leaveType: "casual" as const,
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    halfDay: false,
    reason: "Personal work",
  };
}

describe("leave approval workflow", () => {
  beforeEach(() => resetDemoData());

  it("submits a leave request in 'submitted' status", () => {
    const request = submitLeaveRequest(baseLeaveInput());
    expect(request.status).toBe("submitted");
  });

  it("approves a leave request and records the reviewer", () => {
    const request = submitLeaveRequest(baseLeaveInput());
    approveLeave(request.id, "Principal");
    const updated = getSnapshot().leaveRequests.find((r) => r.id === request.id);
    expect(updated?.status).toBe("approved");
    expect(updated?.reviewerName).toBe("Principal");
  });

  it("rejects a leave request with a note", () => {
    const request = submitLeaveRequest(baseLeaveInput());
    rejectLeave(request.id, "Principal", "Insufficient notice");
    const updated = getSnapshot().leaveRequests.find((r) => r.id === request.id);
    expect(updated?.status).toBe("rejected");
    expect(updated?.reviewerNote).toBe("Insufficient notice");
  });

  it("cancels a leave request without affecting other requests", () => {
    const other = getSnapshot().leaveRequests[0];
    const otherStatusBefore = other.status;
    const request = submitLeaveRequest(baseLeaveInput());

    cancelLeave(request.id);

    expect(getSnapshot().leaveRequests.find((r) => r.id === request.id)?.status).toBe("cancelled");
    expect(getSnapshot().leaveRequests.find((r) => r.id === other.id)?.status).toBe(otherStatusBefore);
  });
});
