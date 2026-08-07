"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";

export function useTransportShiftPolicies() {
  const db = useSisStore();
  return db.transportShiftPolicies;
}

export function useTransportStops() {
  const db = useSisStore();
  return db.transportStops;
}

export function useTransportRoutes() {
  const db = useSisStore();
  return db.transportRoutes;
}

export function useTransportRoute(routeId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.transportRoutes.find((r) => r.id === routeId), [db.transportRoutes, routeId]);
}

export function useRouteStops(routeId?: string) {
  const db = useSisStore();
  return useMemo(() => (routeId ? db.routeStops.filter((rs) => rs.routeId === routeId).sort((a, b) => a.sequence - b.sequence) : db.routeStops), [db.routeStops, routeId]);
}

export function useVehicles() {
  const db = useSisStore();
  return db.vehicles;
}

export function useVehicle(vehicleId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.vehicles.find((v) => v.id === vehicleId), [db.vehicles, vehicleId]);
}

export function useVehicleSeats(vehicleId?: string) {
  const db = useSisStore();
  return useMemo(() => (vehicleId ? db.vehicleSeats.filter((s) => s.vehicleId === vehicleId) : db.vehicleSeats), [db.vehicleSeats, vehicleId]);
}

export function useVehicleDocuments(vehicleId?: string) {
  const db = useSisStore();
  return useMemo(() => (vehicleId ? db.vehicleDocuments.filter((d) => d.vehicleId === vehicleId) : db.vehicleDocuments), [db.vehicleDocuments, vehicleId]);
}

export function useVehicleAssignments(vehicleId?: string) {
  const db = useSisStore();
  return useMemo(() => (vehicleId ? db.vehicleAssignments.filter((a) => a.vehicleId === vehicleId) : db.vehicleAssignments), [db.vehicleAssignments, vehicleId]);
}

export function useDrivers() {
  const db = useSisStore();
  return db.drivers;
}

export function useDriver(driverId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.drivers.find((d) => d.id === driverId), [db.drivers, driverId]);
}

export function useDriverDocuments(driverId?: string) {
  const db = useSisStore();
  return useMemo(() => (driverId ? db.driverDocuments.filter((d) => d.driverId === driverId) : db.driverDocuments), [db.driverDocuments, driverId]);
}

export function useDriverTraining(driverId?: string) {
  const db = useSisStore();
  return useMemo(() => (driverId ? db.driverTraining.filter((t) => t.driverId === driverId) : db.driverTraining), [db.driverTraining, driverId]);
}

export function useAttendants() {
  const db = useSisStore();
  return db.attendants;
}

export function useStudentTransportAssignments(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.studentTransportAssignments.filter((a) => a.studentId === studentId) : db.studentTransportAssignments), [db.studentTransportAssignments, studentId]);
}

export function useStaffTransportAssignments() {
  const db = useSisStore();
  return db.staffTransportAssignments;
}

export function useTransportTrips(date?: string) {
  const db = useSisStore();
  return useMemo(() => (date ? db.transportTrips.filter((t) => t.date === date) : db.transportTrips), [db.transportTrips, date]);
}

export function useTransportTrip(tripId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.transportTrips.find((t) => t.id === tripId), [db.transportTrips, tripId]);
}

export function useTripStops(tripId?: string) {
  const db = useSisStore();
  return useMemo(() => (tripId ? db.tripStops.filter((s) => s.tripId === tripId).sort((a, b) => a.sequence - b.sequence) : db.tripStops), [db.tripStops, tripId]);
}

export function useTripStudents(tripId?: string) {
  const db = useSisStore();
  return useMemo(() => (tripId ? db.tripStudents.filter((s) => s.tripId === tripId) : db.tripStudents), [db.tripStudents, tripId]);
}

export function useGpsDevices() {
  const db = useSisStore();
  return db.gpsDevices;
}

export function useGpsPositions() {
  const db = useSisStore();
  return db.gpsPositions;
}

export function useLatestGpsPosition(vehicleId?: string) {
  const db = useSisStore();
  return useMemo(() => {
    if (!vehicleId) return undefined;
    const positions = db.gpsPositions.filter((p) => p.vehicleId === vehicleId);
    return positions.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];
  }, [db.gpsPositions, vehicleId]);
}

export function useRouteDeviations() {
  const db = useSisStore();
  return db.routeDeviations;
}

export function useTransportIncidents() {
  const db = useSisStore();
  return db.transportIncidents;
}

export function useMaintenanceRecords(vehicleId?: string) {
  const db = useSisStore();
  return useMemo(() => (vehicleId ? db.maintenanceRecords.filter((m) => m.vehicleId === vehicleId) : db.maintenanceRecords), [db.maintenanceRecords, vehicleId]);
}

export function useFuelRecords(vehicleId?: string) {
  const db = useSisStore();
  return useMemo(() => (vehicleId ? db.fuelRecords.filter((f) => f.vehicleId === vehicleId) : db.fuelRecords), [db.fuelRecords, vehicleId]);
}

export function useTransportNotificationRules() {
  const db = useSisStore();
  return db.transportNotificationRules;
}

export function useTransportNotifications() {
  const db = useSisStore();
  return db.transportNotifications;
}

export function useTransportFeeRules() {
  const db = useSisStore();
  return db.transportFeeRules;
}

export function useTransportFeeCharges() {
  const db = useSisStore();
  return db.transportFeeCharges;
}

/** This demo has no driver/attendant login — every /driver and /transport
 * attendant-facing screen previews as this one seeded driver/attendant, the
 * same stand-in-identity pattern used for every other role-specific mobile
 * view in this app (see /pay/[linkId] from Phase 5). */
export function useCurrentDriver() {
  const db = useSisStore();
  return useMemo(() => db.drivers.find((d) => db.transportRoutes.some((r) => r.primaryDriverId === d.id)) ?? db.drivers[0], [db.drivers, db.transportRoutes]);
}

export function useCurrentAttendant() {
  const db = useSisStore();
  return useMemo(() => db.attendants.find((a) => db.transportRoutes.some((r) => r.attendantId === a.id)) ?? db.attendants[0], [db.attendants, db.transportRoutes]);
}
