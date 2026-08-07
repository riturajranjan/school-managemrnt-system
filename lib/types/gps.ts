import type { ID } from "./common";

export type GPSProvider = "external-vendor" | "mobile-device" | "hardware-tracker" | "custom";

export const gpsProviderLabels: Record<GPSProvider, string> = {
  "external-vendor": "External GPS vendor",
  "mobile-device": "Mobile driver device",
  "hardware-tracker": "Hardware tracker",
  custom: "Custom integration",
};

export type GPSDeviceStatus = "online" | "offline" | "weak-signal" | "not-configured";

export const gpsDeviceStatusLabels: Record<GPSDeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  "weak-signal": "Weak signal",
  "not-configured": "Not configured",
};

/** One physical/logical GPS source bound to a vehicle — provider-agnostic so
 * a school can mix a hardware tracker fleet with driver-phone tracking
 * without the rest of the transport module caring which is which. */
export type GPSDevice = {
  id: ID;
  vehicleId: ID;
  provider: GPSProvider;
  deviceIdentifier: string;
  status: GPSDeviceStatus;
  lastCommunicationAt?: string;
  installedAt?: string;
  notes?: string;
};

/** One raw position ping. Never trusted as "live" past its own timestamp —
 * every consumer must compare `recordedAt` against now and show a
 * stale-location indicator rather than silently presenting an old point as
 * current (spec: do not show stale GPS data as live). */
export type GPSPosition = {
  id: ID;
  deviceId: ID;
  vehicleId: ID;
  tripId?: ID;
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDegrees: number;
  accuracyMeters: number;
  ignitionOn?: boolean;
  recordedAt: string;
  receivedAt: string;
};

export type GeofenceShape = "circle" | "polygon";

/** A named safe zone — a stop's pickup radius, the school gate, or a
 * restricted zone. Circle geofences are the common case (stop radius);
 * polygon support exists for irregular campus/zone boundaries. */
export type Geofence = {
  id: ID;
  name: string;
  shape: GeofenceShape;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters?: number;
  polygonPoints?: { latitude: number; longitude: number }[];
  relatedStopId?: ID;
  branch: string;
};

export type RouteDeviationSeverity = "minor" | "moderate" | "severe";

/** Raised when a vehicle's live position departs from its expected route
 * corridor beyond a tolerance — purely a derived/detected record, never
 * hand-entered. */
export type RouteDeviation = {
  id: ID;
  vehicleId: ID;
  tripId: ID;
  routeId: ID;
  detectedAt: string;
  latitude: number;
  longitude: number;
  distanceFromRouteMeters: number;
  severity: RouteDeviationSeverity;
  resolvedAt?: string;
  note?: string;
};

/** Threshold in minutes past a ping's `recordedAt` before it's treated as
 * stale rather than live — a single source of truth so every screen that
 * shows "live" location agrees on the same cutoff (see
 * lib/selectors/gps-insights.ts for the predicate that uses this). */
export const GPS_STALE_THRESHOLD_MINUTES = 3;
