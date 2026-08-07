"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";

// Hostel
export function useHostelBuildings() { return useSisStore().hostelBuildings; }
export function useHostelRooms(buildingId?: string) {
  const db = useSisStore();
  return useMemo(() => (buildingId ? db.hostelRooms.filter((r) => r.buildingId === buildingId) : db.hostelRooms), [db.hostelRooms, buildingId]);
}
export function useHostelRoom(roomId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.hostelRooms.find((r) => r.id === roomId), [db.hostelRooms, roomId]);
}
export function useHostelBeds(roomId?: string) {
  const db = useSisStore();
  return useMemo(() => (roomId ? db.hostelBeds.filter((b) => b.roomId === roomId) : db.hostelBeds), [db.hostelBeds, roomId]);
}
export function useHostelFloors(buildingId?: string) {
  const db = useSisStore();
  return useMemo(() => (buildingId ? db.hostelFloors.filter((f) => f.buildingId === buildingId) : db.hostelFloors), [db.hostelFloors, buildingId]);
}
export function useHostelAllocations() { return useSisStore().hostelAllocations; }
export function useStudentAllocation(studentId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.hostelAllocations.find((a) => a.studentId === studentId && a.status === "active"), [db.hostelAllocations, studentId]);
}
export function useHostelAttendance(date?: string) {
  const db = useSisStore();
  return useMemo(() => (date ? db.hostelAttendance.filter((a) => a.date === date) : db.hostelAttendance), [db.hostelAttendance, date]);
}
export function useHostelLeave() { return useSisStore().hostelLeave; }
export function useHostelVisitors() { return useSisStore().hostelVisitors; }
export function useHostelComplaints() { return useSisStore().hostelComplaints; }
export function useHostelMaintenance() { return useSisStore().hostelMaintenance; }
export function useHostelMess() { return useSisStore().hostelMess; }

// Health
export function useHealthProfile(studentId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.healthProfiles.find((p) => p.studentId === studentId), [db.healthProfiles, studentId]);
}
export function useHealthVisits(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.healthVisits.filter((v) => v.studentId === studentId) : db.healthVisits), [db.healthVisits, studentId]);
}
export function useHealthIncidents(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.healthIncidents.filter((i) => i.studentId === studentId) : db.healthIncidents), [db.healthIncidents, studentId]);
}
export function useMedicationRecords(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.medicationRecords.filter((m) => m.studentId === studentId) : db.medicationRecords), [db.medicationRecords, studentId]);
}
export function useHealthAppointments() { return useSisStore().healthAppointments; }

// Counselling
export function useCounsellingAppointments() { return useSisStore().counsellingAppointments; }
export function useCounsellingResources() { return useSisStore().counsellingResources; }

// Cafeteria
export function useMenuItems() { return useSisStore().menuItems; }
export function useWeeklyMenu() { return useSisStore().weeklyMenu; }
export function useMealPlans() { return useSisStore().mealPlans; }
export function useMealPlanEnrollments() { return useSisStore().mealPlanEnrollments; }
export function useCafeteriaCounters() { return useSisStore().cafeteriaCounters; }
export function useCafeteriaOrders() { return useSisStore().cafeteriaOrders; }
export function useCafeteriaFeedback() { return useSisStore().cafeteriaFeedback; }
export function useCafeteriaInventory() { return useSisStore().cafeteriaInventory; }
