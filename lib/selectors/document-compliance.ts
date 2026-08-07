import type { Db } from "@/lib/data/store";
import type { DriverDocument, DriverDocumentType, TransportDocumentStatus, VehicleDocument, VehicleDocumentType } from "@/lib/types/transport";

const EXPIRING_SOON_WINDOW_DAYS = 30;

/** Vehicle/driver documents without an expiry date (background verification,
 * under-review workflow states) keep their stored status — everything else
 * is recomputed from the expiry date so a status set at seed time can never
 * silently go stale as real time passes, mirroring isGpsStale(). */
export function effectiveDocumentStatus(status: TransportDocumentStatus, expiryDate?: string): TransportDocumentStatus {
  if (status === "under-review" || status === "rejected" || status === "missing") return status;
  if (!expiryDate) return status;
  const today = new Date().toISOString().slice(0, 10);
  const windowDate = new Date(Date.now() + EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (expiryDate < today) return "expired";
  if (expiryDate <= windowDate) return "expiring-soon";
  return "valid";
}

export const REQUIRED_VEHICLE_DOCUMENT_TYPES: VehicleDocumentType[] = ["registration", "insurance", "permit", "fitness-certificate"];
export const REQUIRED_DRIVER_DOCUMENT_TYPES: DriverDocumentType[] = ["license", "medical-fitness", "background-verification"];

export type VehicleComplianceRow = {
  vehicleId: string;
  documents: (VehicleDocument & { effectiveStatus: TransportDocumentStatus })[];
  missingTypes: VehicleDocumentType[];
  blocked: boolean;
  blockedReasons: string[];
};

export type DriverComplianceRow = {
  driverId: string;
  documents: (DriverDocument & { effectiveStatus: TransportDocumentStatus })[];
  missingTypes: DriverDocumentType[];
  blocked: boolean;
  blockedReasons: string[];
};

export function documentCompliance(db: Db) {
  const vehicleRows: VehicleComplianceRow[] = db.vehicles.map((vehicle) => {
    const documents = db.vehicleDocuments.filter((d) => d.vehicleId === vehicle.id).map((d) => ({ ...d, effectiveStatus: effectiveDocumentStatus(d.status, d.expiryDate) }));
    const missingTypes = REQUIRED_VEHICLE_DOCUMENT_TYPES.filter((type) => !documents.some((d) => d.type === type));
    const blockedReasons = [
      ...missingTypes.map((type) => `Missing ${type.replace(/-/g, " ")}`),
      ...documents.filter((d) => REQUIRED_VEHICLE_DOCUMENT_TYPES.includes(d.type) && d.effectiveStatus === "expired").map((d) => `${d.type.replace(/-/g, " ")} expired`),
    ];
    return { vehicleId: vehicle.id, documents, missingTypes, blocked: blockedReasons.length > 0, blockedReasons };
  });

  const driverRows: DriverComplianceRow[] = db.drivers.map((driver) => {
    const documents = db.driverDocuments.filter((d) => d.driverId === driver.id).map((d) => ({ ...d, effectiveStatus: effectiveDocumentStatus(d.status, d.expiryDate) }));
    const missingTypes = REQUIRED_DRIVER_DOCUMENT_TYPES.filter((type) => !documents.some((d) => d.type === type));
    const blockedReasons = [
      ...missingTypes.map((type) => `Missing ${type.replace(/-/g, " ")}`),
      ...documents.filter((d) => REQUIRED_DRIVER_DOCUMENT_TYPES.includes(d.type) && (d.effectiveStatus === "expired" || d.effectiveStatus === "rejected")).map((d) => `${d.type.replace(/-/g, " ")} ${d.effectiveStatus}`),
    ];
    return { driverId: driver.id, documents, missingTypes, blocked: blockedReasons.length > 0, blockedReasons };
  });

  const allStatuses = [...vehicleRows.flatMap((r) => r.documents.map((d) => d.effectiveStatus)), ...driverRows.flatMap((r) => r.documents.map((d) => d.effectiveStatus))];
  const expiredCount = allStatuses.filter((s) => s === "expired").length;
  const expiringSoonCount = allStatuses.filter((s) => s === "expiring-soon").length;
  const blockedVehicles = vehicleRows.filter((r) => r.blocked);
  const blockedDrivers = driverRows.filter((r) => r.blocked);

  return { vehicleRows, driverRows, expiredCount, expiringSoonCount, blockedVehicles, blockedDrivers };
}

/** Used to gate assignment flows — a vehicle/driver with expired or missing
 * critical documents cannot be assigned to a live route. */
export function isVehicleAssignmentBlocked(db: Db, vehicleId: string): boolean {
  return documentCompliance(db).vehicleRows.find((r) => r.vehicleId === vehicleId)?.blocked ?? false;
}

export function isDriverAssignmentBlocked(db: Db, driverId: string): boolean {
  return documentCompliance(db).driverRows.find((r) => r.driverId === driverId)?.blocked ?? false;
}
