import { setState } from "@/lib/data/store";
import type { LeaveRequest } from "@/lib/types/attendance";
import { generateId } from "@/lib/utils";

export function submitLeaveRequest(data: Omit<LeaveRequest, "id" | "status" | "submittedAt">): LeaveRequest {
  const request: LeaveRequest = { ...data, id: generateId("leave"), status: "submitted", submittedAt: new Date().toISOString() };
  setState((db) => ({ ...db, leaveRequests: [request, ...db.leaveRequests] }));
  return request;
}

function mapLeave(requests: LeaveRequest[], id: string, fn: (r: LeaveRequest) => LeaveRequest): LeaveRequest[] {
  return requests.map((r) => (r.id === id ? fn(r) : r));
}

export function approveLeave(id: string, reviewerName: string) {
  setState((db) => ({ ...db, leaveRequests: mapLeave(db.leaveRequests, id, (r) => ({ ...r, status: "approved", reviewerName })) }));
}

export function rejectLeave(id: string, reviewerName: string, reviewerNote: string) {
  setState((db) => ({ ...db, leaveRequests: mapLeave(db.leaveRequests, id, (r) => ({ ...r, status: "rejected", reviewerName, reviewerNote })) }));
}

export function requestMoreInfo(id: string, reviewerName: string, note: string) {
  setState((db) => ({ ...db, leaveRequests: mapLeave(db.leaveRequests, id, (r) => ({ ...r, status: "under-review", reviewerName, reviewerNote: note })) }));
}

export function cancelLeave(id: string) {
  setState((db) => ({ ...db, leaveRequests: mapLeave(db.leaveRequests, id, (r) => ({ ...r, status: "cancelled" })) }));
}
