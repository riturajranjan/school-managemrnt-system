import type { Student } from "@/lib/types/students";
import type { StudentTransportSummary } from "@/lib/types/students";
import type { Teacher } from "@/lib/types/academics";
import type {
  Attendant,
  Driver,
  DriverDocument,
  DriverTraining,
  DropRecord,
  FuelRecord,
  MaintenanceRecord,
  PickupRecord,
  RouteStop,
  StaffTransportAssignment,
  StudentTransportAssignment,
  TransportAttendance,
  TransportFeeCharge,
  TransportFeeRule,
  TransportIncident,
  TransportNotification,
  TransportNotificationRule,
  TransportRoute,
  TransportStop,
  TransportTrip,
  TripStop,
  TripStudent,
  Vehicle,
  VehicleAssignment,
  VehicleDocument,
  VehicleSeat,
} from "@/lib/types/transport";
import type { GPSDevice, GPSPosition, RouteDeviation } from "@/lib/types/gps";
import { moneyFromMajor } from "@/lib/finance/money";
import { buildSeatsForVehicle } from "@/lib/selectors/vehicle-seating";
import { generateId } from "@/lib/utils";
import { CURRENT_SESSION } from "./reference";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(6082026);
export const BRANCH = "main";

// ---------------------------------------------------------------------------
// Stops
// ---------------------------------------------------------------------------

const stopSeed = [
  { name: "Indiranagar 100ft Road", locality: "Indiranagar" },
  { name: "Domlur Signal", locality: "Domlur" },
  { name: "HAL Gate", locality: "HAL" },
  { name: "Whitefield Main", locality: "Whitefield" },
  { name: "Marathahalli Bridge", locality: "Marathahalli" },
  { name: "Brookefield Mall", locality: "Brookefield" },
  { name: "Koramangala 5th Block", locality: "Koramangala" },
  { name: "BTM Layout 2nd Stage", locality: "BTM Layout" },
  { name: "Jayanagar 4th Block", locality: "Jayanagar" },
  { name: "Hebbal Flyover", locality: "Hebbal" },
  { name: "RT Nagar Circle", locality: "RT Nagar" },
  { name: "Yeshwanthpur Junction", locality: "Yeshwanthpur" },
];

export const transportStops: TransportStop[] = stopSeed.map((s, i) => ({
  id: `stop-${i + 1}`,
  name: s.name,
  code: `STP-${String(i + 1).padStart(3, "0")}`,
  address: `${s.name}, Bengaluru`,
  landmark: s.locality,
  latitude: 12.95 + helpers.rand() * 0.12,
  longitude: 77.55 + helpers.rand() * 0.15,
  geofenceRadiusMeters: 150,
  branch: BRANCH,
  status: "active" as const,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
}));
// One stop flagged unsafe for the safety workflow to have something real to show.
transportStops[9] = { ...transportStops[9], status: "unsafe", safetyNotes: "Ongoing road construction — buses use the alternate stop 200m north until further notice." };

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

const vehicleSeed = [
  { reg: "KA-05-AB-1234", fleet: "BUS-01", type: "bus" as const, capacity: 42, make: "Tata", model: "Starbus", year: 2022 },
  { reg: "KA-05-AB-5678", fleet: "BUS-02", type: "bus" as const, capacity: 42, make: "Ashok Leyland", model: "Falcon", year: 2021 },
  { reg: "KA-05-AB-9012", fleet: "BUS-03", type: "bus" as const, capacity: 36, make: "Tata", model: "Starbus", year: 2023 },
  { reg: "KA-05-AB-3456", fleet: "BUS-04", type: "bus" as const, capacity: 42, make: "Force", model: "Traveller", year: 2020 },
  { reg: "KA-05-MB-7788", fleet: "MB-01", type: "mini-bus" as const, capacity: 24, make: "Force", model: "Traveller", year: 2022 },
  { reg: "KA-05-VN-2211", fleet: "VAN-01", type: "van" as const, capacity: 14, make: "Toyota", model: "Innova", year: 2023 },
  { reg: "KA-05-EV-4400", fleet: "EV-01", type: "electric-vehicle" as const, capacity: 30, make: "Tata", model: "Starbus EV", year: 2024 },
  { reg: "KA-05-AB-6600", fleet: "BUS-05", type: "bus" as const, capacity: 42, make: "Ashok Leyland", model: "Falcon", year: 2019 },
];

export const vehicles: Vehicle[] = vehicleSeed.map((v, i) => ({
  id: `vehicle-${i + 1}`,
  registrationNumber: v.reg,
  fleetNumber: v.fleet,
  type: v.type,
  make: v.make,
  model: v.model,
  year: v.year,
  capacity: v.capacity,
  fuelType: v.type === "electric-vehicle" ? "electric" : helpers.bool(0.7) ? "diesel" : "cng",
  chassisNumber: `CH${100000 + i * 137}`,
  engineNumber: `EN${200000 + i * 211}`,
  odometerKm: helpers.int(18000, 96000),
  gpsDeviceId: `gps-device-${i + 1}`,
  branch: BRANCH,
  status: i === 7 ? "maintenance" : "assigned",
  purchaseDate: `${2019 + (i % 5)}-06-15`,
  ownershipType: i === 5 ? "contracted" : "owned",
  createdAt: "2025-06-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
}));

export const vehicleDocuments: VehicleDocument[] = vehicles.flatMap((v, i) => {
  const base: { type: VehicleDocument["type"]; monthsToExpiry: number }[] = [
    { type: "registration", monthsToExpiry: 24 },
    { type: "insurance", monthsToExpiry: i === 1 ? 0 : i === 3 ? 1 : 10 },
    { type: "permit", monthsToExpiry: 14 },
    { type: "fitness-certificate", monthsToExpiry: i === 2 ? -1 : 8 },
    { type: "pollution-certificate", monthsToExpiry: i === 4 ? 0.2 : 5 },
  ];
  return base.map((d, j) => {
    const expiryDate = helpers.daysFromNowIso(Math.round(d.monthsToExpiry * 30));
    const status = d.monthsToExpiry < 0 ? "expired" : d.monthsToExpiry <= 1 ? "expiring-soon" : "valid";
    return {
      id: `vdoc-${i + 1}-${j + 1}`,
      vehicleId: v.id,
      type: d.type,
      documentNumber: `${d.type.toUpperCase().slice(0, 3)}-${v.registrationNumber}`,
      issuedBy: "RTO Bengaluru",
      issueDate: "2024-01-01",
      expiryDate: expiryDate.slice(0, 10),
      status: status as VehicleDocument["status"],
    } satisfies VehicleDocument;
  });
});

// ---------------------------------------------------------------------------
// Seats — a simple 2-2 bus layout per vehicle, scaled to capacity
// ---------------------------------------------------------------------------

export const vehicleSeats: VehicleSeat[] = vehicles.flatMap(buildSeatsForVehicle);

// ---------------------------------------------------------------------------
// GPS devices — one per vehicle
// ---------------------------------------------------------------------------

export const gpsDevices: GPSDevice[] = vehicles.map((v, i) => ({
  id: `gps-device-${i + 1}`,
  vehicleId: v.id,
  provider: i % 3 === 0 ? "hardware-tracker" : i % 3 === 1 ? "mobile-device" : "external-vendor",
  deviceIdentifier: `TRK-${1000 + i}`,
  status: i === 6 ? "offline" : "online",
  lastCommunicationAt: i === 6 ? helpers.daysAgoIso(1) : new Date().toISOString(),
  installedAt: "2025-06-01T00:00:00.000Z",
}));

// ---------------------------------------------------------------------------
// Drivers and attendants
// ---------------------------------------------------------------------------

const driverNames = ["Ramesh Kumar", "Suresh Babu", "Manjunath Rao", "Lokesh Gowda", "Prakash Reddy", "Venkatesh Iyer", "Nagaraj Shetty", "Girish Achar"];

export const drivers: Driver[] = driverNames.map((name, i) => ({
  id: `driver-${i + 1}`,
  name,
  employeeCode: `DRV-${String(i + 1).padStart(3, "0")}`,
  phone: `98450${String(10000 + i * 137).slice(0, 5)}`,
  emergencyContactName: `${name.split(" ")[0]}'s family`,
  emergencyContactPhone: `98450${String(20000 + i * 91).slice(0, 5)}`,
  joiningDate: `${2019 + (i % 4)}-03-01`,
  licenseNumber: `KA${1000000000 + i * 91}`,
  licenseClass: "Heavy Motor Vehicle",
  licenseExpiry: i === 3 ? helpers.daysFromNowIso(-10).slice(0, 10) : helpers.daysFromNowIso(400).slice(0, 10),
  badgeNumber: `BADGE-${500 + i}`,
  backgroundVerified: i !== 6,
  medicalFitnessValid: i !== 5,
  branch: BRANCH,
  status: i === 3 ? "license-expired" : i === 5 ? "medical-review" : "assigned",
  createdAt: "2025-06-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
}));

export const driverDocuments: DriverDocument[] = drivers.flatMap((d, i) => [
  { id: `ddoc-${i + 1}-license`, driverId: d.id, type: "license" as const, documentNumber: d.licenseNumber, expiryDate: d.licenseExpiry, status: d.status === "license-expired" ? ("expired" as const) : ("valid" as const) },
  { id: `ddoc-${i + 1}-badge`, driverId: d.id, type: "badge" as const, documentNumber: d.badgeNumber, expiryDate: helpers.daysFromNowIso(300).slice(0, 10), status: "valid" as const },
  { id: `ddoc-${i + 1}-medical`, driverId: d.id, type: "medical-fitness" as const, expiryDate: helpers.daysFromNowIso(i === 5 ? -5 : 200).slice(0, 10), status: i === 5 ? ("expired" as const) : ("valid" as const) },
  { id: `ddoc-${i + 1}-bgv`, driverId: d.id, type: "background-verification" as const, status: i === 6 ? ("under-review" as const) : ("valid" as const) },
]);

export const driverTraining: DriverTraining[] = drivers.slice(0, 5).map((d, i) => ({
  id: `dtrain-${i + 1}`,
  driverId: d.id,
  title: "Defensive driving & child safety",
  completedAt: helpers.daysAgoIso(120 + i * 10),
  expiresAt: helpers.daysFromNowIso(245 - i * 10),
  conductedBy: "Transport Safety Cell",
}));

const attendantNames = ["Lakshmi Devi", "Kavitha Nair", "Sunita Sharma", "Radha Krishnan", "Meena Kumari"];

export const attendants: Attendant[] = attendantNames.map((name, i) => ({
  id: `attendant-${i + 1}`,
  name,
  employeeCode: `ATT-${String(i + 1).padStart(3, "0")}`,
  phone: `98460${String(10000 + i * 151).slice(0, 5)}`,
  emergencyContactPhone: `98460${String(30000 + i * 71).slice(0, 5)}`,
  joiningDate: `${2020 + (i % 3)}-06-01`,
  branch: BRANCH,
  status: "assigned",
  createdAt: "2025-06-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
}));

// ---------------------------------------------------------------------------
// Routes and route stops
// ---------------------------------------------------------------------------

const routeSeed = [
  { name: "Route 1 — Indiranagar Corridor", stopIdx: [0, 1, 2], vehicleIdx: 0, driverIdx: 0, backupIdx: 1, attendantIdx: 0, shift: "morning" as const },
  { name: "Route 2 — Whitefield Express", stopIdx: [3, 4, 5], vehicleIdx: 1, driverIdx: 1, backupIdx: 2, attendantIdx: 1, shift: "morning" as const },
  { name: "Route 3 — Koramangala Loop", stopIdx: [6, 7, 8], vehicleIdx: 2, driverIdx: 2, backupIdx: 0, attendantIdx: 2, shift: "morning" as const },
  { name: "Route 4 — Hebbal North", stopIdx: [9, 10, 11], vehicleIdx: 3, driverIdx: 4, backupIdx: 3, attendantIdx: 3, shift: "morning" as const },
  { name: "Route 5 — Marathahalli Mini", stopIdx: [4, 5], vehicleIdx: 4, driverIdx: 5, backupIdx: 1, attendantIdx: 4, shift: "afternoon" as const },
  { name: "Route 6 — Staff Shuttle", stopIdx: [0, 6, 9], vehicleIdx: 5, driverIdx: 6, backupIdx: 7, attendantIdx: undefined, shift: "both" as const },
];

export const transportRoutes: TransportRoute[] = routeSeed.map((r, i) => ({
  id: `route-${i + 1}`,
  name: r.name,
  code: `RT-${String(i + 1).padStart(2, "0")}`,
  branch: BRANCH,
  shift: r.shift,
  direction: "both",
  type: i === 5 ? "staff-transport" : "morning-pickup",
  startPoint: transportStops[r.stopIdx[0]].name,
  endPoint: "Novyra Public School",
  distanceKm: 8 + r.stopIdx.length * 3.2,
  estimatedDurationMinutes: 25 + r.stopIdx.length * 8,
  vehicleType: vehicles[r.vehicleIdx].type,
  maxCapacity: vehicles[r.vehicleIdx].capacity,
  assignedVehicleId: vehicles[r.vehicleIdx].id,
  primaryDriverId: drivers[r.driverIdx].id,
  backupDriverId: drivers[r.backupIdx].id,
  attendantId: r.attendantIdx !== undefined ? attendants[r.attendantIdx].id : undefined,
  effectiveFrom: "2026-04-01",
  status: "active",
  createdBy: "Transport Administrator",
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
}));

export const routeStops: RouteStop[] = routeSeed.flatMap((r, ri) =>
  r.stopIdx.map((stopIdx, seq) => ({
    id: `rstop-${ri + 1}-${seq + 1}`,
    routeId: transportRoutes[ri].id,
    stopId: transportStops[stopIdx].id,
    sequence: seq + 1,
    pickupTime: `0${6 + Math.floor(seq / 2)}:${seq % 2 === 0 ? "15" : "45"}`,
    dropTime: `1${5 + Math.floor(seq / 2)}:${seq % 2 === 0 ? "10" : "40"}`,
    waitingMinutes: 3,
    distanceFromPreviousKm: seq === 0 ? 0 : 2.4 + helpers.rand() * 1.5,
  })),
);

export const vehicleAssignments: VehicleAssignment[] = routeSeed.map((r, i) => ({
  id: `vassign-${i + 1}`,
  vehicleId: vehicles[r.vehicleIdx].id,
  routeId: transportRoutes[i].id,
  driverId: drivers[r.driverIdx].id,
  attendantId: r.attendantIdx !== undefined ? attendants[r.attendantIdx].id : undefined,
  effectiveFrom: "2026-04-01",
  status: "active",
  createdAt: "2026-04-01T00:00:00.000Z",
}));

// ---------------------------------------------------------------------------
// Student & staff transport assignments — derived from real student data
// ---------------------------------------------------------------------------

export type TransportSeedResult = {
  studentAssignments: StudentTransportAssignment[];
  studentSummaries: Map<string, StudentTransportSummary>;
  vehicleSeats: VehicleSeat[];
  staffAssignments: StaffTransportAssignment[];
  trips: TransportTrip[];
  tripStops: TripStop[];
  tripStudents: TripStudent[];
  pickupRecords: PickupRecord[];
  dropRecords: DropRecord[];
  transportAttendance: TransportAttendance[];
  gpsPositions: GPSPosition[];
  routeDeviations: RouteDeviation[];
  incidents: TransportIncident[];
  maintenanceRecords: MaintenanceRecord[];
  fuelRecords: FuelRecord[];
  notificationRules: TransportNotificationRule[];
  notifications: TransportNotification[];
  feeRules: TransportFeeRule[];
  feeCharges: TransportFeeCharge[];
};

export function generateTransportData(students: Student[], teachers: Teacher[]): TransportSeedResult {
  // --- Student assignments: ~35% of active students, spread across routes ---
  const eligibleStudents = students.filter((s) => s.status === "active");
  const assignedStudents = helpers.pickMany(eligibleStudents, Math.round(eligibleStudents.length * 0.35));
  const studentAssignments: StudentTransportAssignment[] = [];
  const studentSummaries = new Map<string, StudentTransportSummary>();

  assignedStudents.forEach((student, i) => {
    const routeIndex = i % transportRoutes.length;
    const route = transportRoutes[routeIndex];
    const stopsForRoute = routeStops.filter((rs) => rs.routeId === route.id);
    const pickupStop = helpers.pick(stopsForRoute);
    const dropStop = pickupStop;
    const seatsForVehicle = vehicleSeats.filter((s) => s.vehicleId === route.assignedVehicleId && s.type === "standard");
    const seat = seatsForVehicle[i % Math.max(1, seatsForVehicle.length)];

    const assignment: StudentTransportAssignment = {
      id: generateId("sta"),
      studentId: student.id,
      session: CURRENT_SESSION,
      routeId: route.id,
      pickupStopId: pickupStop.stopId,
      dropStopId: dropStop.stopId,
      shift: route.shift,
      vehicleId: route.assignedVehicleId,
      seatId: seat?.id,
      effectiveFrom: "2026-04-01",
      status: "active",
      createdBy: "Transport Administrator",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };
    studentAssignments.push(assignment);

    const stopMeta = transportStops.find((s) => s.id === pickupStop.stopId)!;
    studentSummaries.set(student.id, {
      routeId: route.id,
      routeName: route.name,
      stopName: stopMeta.name,
      pickupTime: pickupStop.pickupTime ?? "07:00",
      dropTime: pickupStop.dropTime ?? "15:30",
    });
  });

  // Mark the corresponding seats occupied — builds a fresh array rather than
  // mutating the shared module-level `vehicleSeats` export, so this function
  // stays a pure generator safe to call more than once (e.g. on reset).
  const seatUpdates = new Map(studentAssignments.filter((a) => a.seatId).map((a) => [a.seatId!, { studentId: a.studentId, routeId: a.routeId }]));
  const updatedVehicleSeats = vehicleSeats.map((seat) => {
    const update = seatUpdates.get(seat.id);
    return update ? { ...seat, ...update } : seat;
  });

  // --- Staff transport (a couple of teachers on the staff shuttle) ---
  const staffRoute = transportRoutes[5];
  const staffAssignments: StaffTransportAssignment[] = teachers.slice(0, 2).map((teacher) => ({
    id: generateId("staffta"),
    staffName: teacher.name,
    staffId: teacher.id,
    routeId: staffRoute.id,
    pickupStopId: routeStops.find((rs) => rs.routeId === staffRoute.id)!.stopId,
    shift: "both",
    status: "active",
    effectiveFrom: "2026-04-01",
    createdAt: "2026-04-01T00:00:00.000Z",
  }));

  // --- Today's trips: one per active route, in varied realistic states ---
  const today = new Date().toISOString().slice(0, 10);
  const tripStatuses: TransportTrip["status"][] = ["completed", "completed", "in-progress", "delayed", "boarding", "scheduled"];
  const trips: TransportTrip[] = transportRoutes.map((route, i) => {
    const status = tripStatuses[i % tripStatuses.length];
    const studentsForRoute = studentAssignments.filter((a) => a.routeId === route.id);
    const boarded = status === "completed" || status === "in-progress" || status === "delayed" ? studentsForRoute.length - (status === "delayed" ? 1 : 0) : 0;
    return {
      id: `trip-${i + 1}`,
      tripNumber: `TRIP-${today.replace(/-/g, "")}-${String(i + 1).padStart(2, "0")}`,
      routeId: route.id,
      direction: "pickup",
      date: today,
      shift: route.shift,
      vehicleId: route.assignedVehicleId!,
      driverId: route.primaryDriverId!,
      attendantId: route.attendantId,
      plannedStart: `${today}T01:15:00.000Z`,
      actualStart: status === "scheduled" ? undefined : `${today}T01:17:00.000Z`,
      plannedEnd: `${today}T02:00:00.000Z`,
      actualEnd: status === "completed" ? `${today}T02:05:00.000Z` : undefined,
      studentsExpected: studentsForRoute.length,
      studentsBoarded: boarded,
      studentsDropped: status === "completed" ? boarded : 0,
      distanceKm: route.distanceKm,
      status,
      createdAt: `${today}T00:30:00.000Z`,
      updatedAt: `${today}T02:00:00.000Z`,
    } satisfies TransportTrip;
  });

  // --- Trip stops, per trip from its route's stops ---
  const tripStops: TripStop[] = trips.flatMap((trip) => {
    const stopsForRoute = routeStops.filter((rs) => rs.routeId === trip.routeId).sort((a, b) => a.sequence - b.sequence);
    return stopsForRoute.map((rs, seq) => {
      const stopStatus: TripStop["status"] = trip.status === "completed" ? "departed" : trip.status === "in-progress" && seq === 0 ? "departed" : trip.status === "scheduled" ? "pending" : seq === 0 ? "departed" : "pending";
      return {
        id: `tstop-${trip.id}-${seq + 1}`,
        tripId: trip.id,
        stopId: rs.stopId,
        sequence: seq + 1,
        plannedArrival: `${today}T0${1 + seq}:${rs.pickupTime?.slice(3) ?? "15"}:00.000Z`,
        actualArrival: stopStatus !== "pending" ? `${today}T0${1 + seq}:${rs.pickupTime?.slice(3) ?? "18"}:00.000Z` : undefined,
        plannedDeparture: `${today}T0${1 + seq}:${rs.waitingMinutes + 15}:00.000Z`,
        actualDeparture: stopStatus === "departed" ? `${today}T0${1 + seq}:${rs.waitingMinutes + 18}:00.000Z` : undefined,
        status: stopStatus,
      } satisfies TripStop;
    });
  });

  // --- Trip students, pickup/drop records, attendance rollup ---
  const tripStudents: TripStudent[] = [];
  const pickupRecords: PickupRecord[] = [];
  const dropRecords: DropRecord[] = [];
  const transportAttendance: TransportAttendance[] = [];

  for (const trip of trips) {
    const studentsForRoute = studentAssignments.filter((a) => a.routeId === trip.routeId);
    studentsForRoute.forEach((assignment, si) => {
      const isCompleted = trip.status === "completed";
      const isRunning = trip.status === "in-progress" || trip.status === "delayed";
      const missedThisOne = trip.status === "delayed" && si === 0;

      const pickupStatus: TripStudent["pickupStatus"] = missedThisOne ? "missed" : isCompleted || isRunning ? "boarded" : "expected";
      const dropStatus: TripStudent["dropStatus"] = isCompleted ? "dropped" : isRunning ? "onboard" : "not-confirmed";

      tripStudents.push({ id: `tstu-${trip.id}-${si + 1}`, tripId: trip.id, studentId: assignment.studentId, stopId: assignment.pickupStopId, pickupStatus, dropStatus });

      if (pickupStatus === "boarded" || pickupStatus === "missed") {
        pickupRecords.push({
          id: generateId("pickup"),
          tripId: trip.id,
          studentId: assignment.studentId,
          stopId: assignment.pickupStopId,
          status: pickupStatus,
          verificationMethod: pickupStatus === "boarded" ? "attendant-confirmation" : undefined,
          recordedBy: attendants.find((a) => a.id === trip.attendantId)?.name ?? "Driver",
          recordedAt: `${today}T01:30:00.000Z`,
          reason: pickupStatus === "missed" ? "Parent reported student unwell" : undefined,
        });
      }
      if (dropStatus === "dropped") {
        dropRecords.push({
          id: generateId("drop"),
          tripId: trip.id,
          studentId: assignment.studentId,
          stopId: assignment.dropStopId,
          status: "dropped",
          verificationMethod: "attendant-confirmation",
          recordedBy: attendants.find((a) => a.id === trip.attendantId)?.name ?? "Driver",
          recordedAt: `${today}T02:05:00.000Z`,
        });
      }
      transportAttendance.push({ id: generateId("tatt"), tripId: trip.id, studentId: assignment.studentId, routeId: trip.routeId, date: today, pickupStatus, dropStatus });
    });
  }

  // --- GPS positions — one recent ping per active/in-progress vehicle ---
  const gpsPositions: GPSPosition[] = trips
    .filter((t) => t.status === "in-progress" || t.status === "delayed" || t.status === "boarding")
    .map((trip, i) => {
      const device = gpsDevices.find((g) => g.vehicleId === trip.vehicleId)!;
      const isStale = trip.vehicleId === vehicles[6].id;
      return {
        id: generateId("gpsp"),
        deviceId: device.id,
        vehicleId: trip.vehicleId,
        tripId: trip.id,
        latitude: 12.95 + helpers.rand() * 0.12,
        longitude: 77.55 + helpers.rand() * 0.15,
        speedKmh: trip.status === "delayed" ? 8 : 28 + helpers.int(0, 15),
        headingDegrees: helpers.int(0, 359),
        accuracyMeters: 12,
        ignitionOn: true,
        recordedAt: isStale ? helpers.daysAgoIso(1) : new Date(Date.now() - i * 20000).toISOString(),
        receivedAt: new Date().toISOString(),
      } satisfies GPSPosition;
    });

  const routeDeviations: RouteDeviation[] = [
    {
      id: generateId("deviation"),
      vehicleId: vehicles[3].id,
      tripId: "trip-4",
      routeId: "route-4",
      detectedAt: `${today}T01:40:00.000Z`,
      latitude: 13.02,
      longitude: 77.6,
      distanceFromRouteMeters: 620,
      severity: "moderate",
      note: "Detoured around a road closure near Hebbal flyover.",
    },
  ];

  // --- Incidents ---
  const incidents: TransportIncident[] = [
    {
      id: generateId("incident"),
      incidentNumber: "INC-2026-0001",
      type: "breakdown",
      occurredAt: helpers.daysAgoIso(3),
      vehicleId: vehicles[7].id,
      routeId: "route-8",
      location: "Outer Ring Road near Marathahalli",
      reportedBy: drivers[7]?.name ?? drivers[0].name,
      severity: "high",
      description: "Engine overheating forced the vehicle to stop; students transferred to a backup vehicle.",
      immediateAction: "Backup vehicle dispatched, all students reached school within 25 minutes of planned time.",
      parentCommunicated: true,
      authorityCommunicated: false,
      status: "resolved",
      resolution: "Radiator hose replaced; vehicle returned to service after inspection.",
      createdAt: helpers.daysAgoIso(3),
      updatedAt: helpers.daysAgoIso(2),
    },
    {
      id: generateId("incident"),
      incidentNumber: "INC-2026-0002",
      type: "missed-student",
      occurredAt: `${today}T01:35:00.000Z`,
      routeId: "route-4",
      tripId: "trip-4",
      location: transportStops[9].name,
      reportedBy: attendants[3].name,
      severity: "medium",
      description: "Student not present at the stop at pickup time; parent contacted and confirmed a planned absence.",
      immediateAction: "Logged as missed pickup, parent notified via SMS.",
      parentCommunicated: true,
      authorityCommunicated: false,
      status: "closed",
      resolution: "Confirmed planned absence — no further action needed.",
      createdAt: `${today}T01:35:00.000Z`,
      updatedAt: `${today}T01:40:00.000Z`,
    },
    {
      id: generateId("incident"),
      incidentNumber: "INC-2026-0003",
      type: "gps-failure",
      occurredAt: helpers.daysAgoIso(1),
      vehicleId: vehicles[6].id,
      reportedBy: "Transport Manager",
      severity: "low",
      description: "GPS device stopped reporting position updates.",
      immediateAction: "Transport office notified; device scheduled for inspection.",
      parentCommunicated: false,
      authorityCommunicated: false,
      status: "investigating",
      createdAt: helpers.daysAgoIso(1),
      updatedAt: helpers.daysAgoIso(1),
    },
  ];

  // --- Maintenance ---
  const maintenanceRecords: MaintenanceRecord[] = vehicles.map((v, i) => {
    const overdue = i === 7;
    const dueSoon = i === 2;
    const status: MaintenanceRecord["status"] = overdue ? "overdue" : dueSoon ? "due-soon" : i % 3 === 0 ? "completed" : "scheduled";
    const maintenanceId = generateId("maint");
    return {
      id: maintenanceId,
      vehicleId: v.id,
      type: overdue ? "breakdown-repair" : "routine-service",
      odometerKm: v.odometerKm,
      scheduledDate: overdue ? helpers.daysAgoIso(5).slice(0, 10) : dueSoon ? helpers.daysFromNowIso(4).slice(0, 10) : helpers.daysFromNowIso(20 + i).slice(0, 10),
      completedDate: status === "completed" ? helpers.daysAgoIso(30).slice(0, 10) : undefined,
      vendor: "CityAuto Service Centre",
      cost: moneyFromMajor(status === "completed" ? 4200 + i * 150 : 0, "INR"),
      labourCost: moneyFromMajor(status === "completed" ? 1200 : 0, "INR"),
      parts: status === "completed" ? [{ id: generateId("mpart"), maintenanceId, name: "Oil filter", quantity: 1, cost: moneyFromMajor(450, "INR") }] : [],
      nextDueOdometerKm: v.odometerKm + 5000,
      nextDueDate: helpers.daysFromNowIso(90).slice(0, 10),
      status,
      createdAt: helpers.daysAgoIso(35),
    } satisfies MaintenanceRecord;
  });

  // --- Fuel ---
  const fuelRecords: FuelRecord[] = vehicles
    .filter((v) => v.fuelType !== "electric")
    .flatMap((v, i) =>
      [0, 1, 2].map((k) => {
        const litres = 38 + helpers.int(0, 20);
        const rate = moneyFromMajor(96, "INR");
        return {
          id: generateId("fuel"),
          vehicleId: v.id,
          date: helpers.daysAgoIso(k * 7 + i).slice(0, 10),
          odometerKm: v.odometerKm - k * 300,
          quantityLitres: litres,
          fuelType: v.fuelType,
          rate,
          totalCost: moneyFromMajor(litres * 96, "INR"),
          vendor: "HP Petrol Pump — Outer Ring Road",
          filledBy: drivers[i % drivers.length].name,
          fullTank: true,
        } satisfies FuelRecord;
      }),
    );

  // --- Notification rules + a handful of sent notifications ---
  const notificationRules: TransportNotificationRule[] = [
    { id: generateId("tnr"), name: "Bus departed", trigger: "bus-departed", channels: ["push", "sms"], audience: "parent", templateEn: "Your child's bus ({routeName}) has departed and is on its way.", templateHi: "आपके बच्चे की बस ({routeName}) रवाना हो गई है।", status: "active", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
    { id: generateId("tnr"), name: "Student boarded", trigger: "student-boarded", channels: ["push"], audience: "parent", templateEn: "{studentName} has boarded the bus at {stopName}.", templateHi: "{studentName} {stopName} पर बस में चढ़ गए हैं।", status: "active", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
    { id: generateId("tnr"), name: "Student dropped", trigger: "student-dropped", channels: ["push", "sms"], audience: "parent", templateEn: "{studentName} has been dropped safely at {stopName}.", templateHi: "{studentName} को {stopName} पर सुरक्षित उतार दिया गया है।", status: "active", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
    { id: generateId("tnr"), name: "Missed pickup", trigger: "student-missed-pickup", channels: ["push", "sms", "whatsapp"], audience: "parent", templateEn: "{studentName} was not at {stopName} for pickup. Please contact the transport office.", status: "active", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
    { id: generateId("tnr"), name: "Delay alert", trigger: "delay", channels: ["push"], audience: "parent", templateEn: "{routeName} is running approximately {delayMinutes} minutes late.", status: "active", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
    { id: generateId("tnr"), name: "Breakdown alert", trigger: "breakdown", channels: ["push", "sms"], audience: "parent", templateEn: "The bus on {routeName} has a mechanical issue. A replacement vehicle has been arranged.", status: "active", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
    { id: generateId("tnr"), name: "Document expiry", trigger: "document-expiry", channels: ["in-app", "email"], audience: "transport-office", templateEn: "{documentType} for {vehicleOrDriverName} expires on {expiryDate}.", status: "active", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
    { id: generateId("tnr"), name: "Emergency", trigger: "emergency", channels: ["push", "sms", "whatsapp", "email"], audience: "parent", templateEn: "URGENT: An emergency has been reported on {routeName}. The transport office will contact you shortly.", status: "active", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
  ];

  const notifications: TransportNotification[] = trips
    .filter((t) => t.status === "completed" || t.status === "in-progress" || t.status === "delayed")
    .slice(0, 4)
    .map((trip, i) => ({
      id: generateId("tnotif"),
      ruleId: notificationRules[trip.status === "delayed" ? 4 : 0].id,
      trigger: trip.status === "delayed" ? "delay" : "bus-departed",
      channel: "push",
      audience: "parent",
      recipientId: studentAssignments.find((a) => a.routeId === trip.routeId)?.studentId ?? "student-unknown",
      tripId: trip.id,
      message: trip.status === "delayed" ? `${transportRoutes.find((r) => r.id === trip.routeId)?.name} is running late.` : `${transportRoutes.find((r) => r.id === trip.routeId)?.name} bus has departed.`,
      sentAt: `${today}T01:2${i}:00.000Z`,
      status: "sent",
    }));

  // --- Fee rules, one per active pickup/drop route ---
  const feeRules: TransportFeeRule[] = transportRoutes.map((route, i) => ({
    id: generateId("tfr"),
    name: `${route.name} — Monthly fee`,
    basis: "route",
    routeId: route.id,
    amount: moneyFromMajor(2200 + i * 250, "INR"),
    frequency: "monthly",
    session: CURRENT_SESSION,
    siblingDiscountPercent: 10,
    staffDiscountPercent: route.type === "staff-transport" ? 100 : undefined,
    status: "active",
    createdAt: "2026-04-01T00:00:00.000Z",
  }));

  // --- Fee charges — one per active assignment for the current billing period ---
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const studentFeeCharges: TransportFeeCharge[] = studentAssignments
    .filter((a) => a.status === "active")
    .map((assignment): TransportFeeCharge | undefined => {
      const rule = feeRules.find((r) => r.routeId === assignment.routeId && r.status === "active");
      if (!rule) return undefined;
      const student = students.find((s) => s.id === assignment.studentId);
      const discountPercent = student?.admissionType === "sibling" ? rule.siblingDiscountPercent : undefined;
      const billedAmount = discountPercent ? moneyFromMajor(Math.round((rule.amount.minorUnits / 100) * (1 - discountPercent / 100)), "INR") : rule.amount;
      const paid = helpers.bool(0.7);
      return {
        id: generateId("tfc"),
        feeRuleId: rule.id,
        subjectType: "student",
        studentId: assignment.studentId,
        assignmentId: assignment.id,
        session: CURRENT_SESSION,
        period: currentPeriod,
        billedAmount,
        discountPercent,
        paidAmount: paid ? billedAmount : moneyFromMajor(0, "INR"),
        dueDate: `${currentPeriod}-10`,
        status: paid ? "paid" : "pending",
        createdAt: "2026-08-01T00:00:00.000Z",
      };
    })
    .filter((c): c is TransportFeeCharge => c !== undefined);

  const staffFeeCharges: TransportFeeCharge[] = staffAssignments
    .filter((a) => a.status === "active")
    .map((assignment): TransportFeeCharge | undefined => {
      const rule = feeRules.find((r) => r.routeId === assignment.routeId && r.status === "active");
      if (!rule) return undefined;
      const discountPercent = rule.staffDiscountPercent;
      const billedAmount = discountPercent ? moneyFromMajor(Math.round((rule.amount.minorUnits / 100) * (1 - discountPercent / 100)), "INR") : rule.amount;
      return {
        id: generateId("tfc"),
        feeRuleId: rule.id,
        subjectType: "staff",
        staffId: assignment.staffId,
        assignmentId: assignment.id,
        session: CURRENT_SESSION,
        period: currentPeriod,
        billedAmount,
        discountPercent,
        paidAmount: billedAmount,
        dueDate: `${currentPeriod}-10`,
        status: "paid",
        createdAt: "2026-08-01T00:00:00.000Z",
      };
    })
    .filter((c): c is TransportFeeCharge => c !== undefined);

  const feeCharges: TransportFeeCharge[] = [...studentFeeCharges, ...staffFeeCharges];

  return {
    studentAssignments,
    studentSummaries,
    vehicleSeats: updatedVehicleSeats,
    staffAssignments,
    trips,
    tripStops,
    tripStudents,
    pickupRecords,
    dropRecords,
    transportAttendance,
    gpsPositions,
    routeDeviations,
    incidents,
    maintenanceRecords,
    fuelRecords,
    notificationRules,
    notifications,
    feeRules,
    feeCharges,
  };
}
