"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";

export function useEmployees() {
  return useSisStore().employees;
}

export function useEmployee(employeeId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.employees.find((e) => e.id === employeeId), [db.employees, employeeId]);
}

export function useDepartments() {
  return useSisStore().departments;
}

export function useDesignations() {
  return useSisStore().designations;
}

export function useShifts() {
  return useSisStore().shifts;
}

export function useContracts(employeeId?: string) {
  const db = useSisStore();
  return useMemo(() => (employeeId ? db.contracts.filter((c) => c.employeeId === employeeId) : db.contracts), [db.contracts, employeeId]);
}

export function useStaffDocuments(employeeId?: string) {
  const db = useSisStore();
  return useMemo(() => (employeeId ? db.staffDocuments.filter((d) => d.employeeId === employeeId) : db.staffDocuments), [db.staffDocuments, employeeId]);
}

export function useHrAttendance(filter?: { employeeId?: string; date?: string }) {
  const db = useSisStore();
  const employeeId = filter?.employeeId;
  const date = filter?.date;
  return useMemo(() => db.hrAttendance.filter((a) => (!employeeId || a.employeeId === employeeId) && (!date || a.date === date)), [db.hrAttendance, employeeId, date]);
}

export function useLeaveRequests(employeeId?: string) {
  const db = useSisStore();
  return useMemo(() => (employeeId ? db.hrLeaveRequests.filter((r) => r.employeeId === employeeId) : db.hrLeaveRequests), [db.hrLeaveRequests, employeeId]);
}

export function useLeaveBalances(employeeId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.leaveBalances.filter((b) => b.employeeId === employeeId), [db.leaveBalances, employeeId]);
}

export function useJobs() {
  return useSisStore().recruitmentJobs;
}

export function useJob(jobId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.recruitmentJobs.find((j) => j.id === jobId), [db.recruitmentJobs, jobId]);
}

export function useCandidates(jobId?: string) {
  const db = useSisStore();
  return useMemo(() => (jobId ? db.candidates.filter((c) => c.jobId === jobId) : db.candidates), [db.candidates, jobId]);
}

export function useCandidate(candidateId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.candidates.find((c) => c.id === candidateId), [db.candidates, candidateId]);
}

export function useInterviews() {
  return useSisStore().interviews;
}

export function useOnboardingTasks(employeeId?: string) {
  const db = useSisStore();
  return useMemo(() => (employeeId ? db.onboardingTasks.filter((t) => t.employeeId === employeeId) : db.onboardingTasks), [db.onboardingTasks, employeeId]);
}

export function useOffboardingCases() {
  return useSisStore().offboardingCases;
}

export function usePerformanceReviews(employeeId?: string) {
  const db = useSisStore();
  return useMemo(() => (employeeId ? db.performanceReviews.filter((r) => r.employeeId === employeeId) : db.performanceReviews), [db.performanceReviews, employeeId]);
}

export function useGoals(employeeId?: string) {
  const db = useSisStore();
  return useMemo(() => (employeeId ? db.performanceGoals.filter((g) => g.employeeId === employeeId) : db.performanceGoals), [db.performanceGoals, employeeId]);
}

export function useTrainingCourses() {
  return useSisStore().trainingCourses;
}

export function useTrainingEnrollments(employeeId?: string) {
  const db = useSisStore();
  return useMemo(() => (employeeId ? db.trainingEnrollments.filter((e) => e.employeeId === employeeId) : db.trainingEnrollments), [db.trainingEnrollments, employeeId]);
}

export function useEmployeeTimeline(employeeId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.employeeTimeline.filter((t) => t.employeeId === employeeId).sort((a, b) => b.date.localeCompare(a.date)), [db.employeeTimeline, employeeId]);
}

/** Convenience: full display name for an employee id. */
export function useEmployeeName() {
  const db = useSisStore();
  return (id?: string) => {
    const e = db.employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "—";
  };
}
