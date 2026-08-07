import type { Vehicle, VehicleSeat } from "@/lib/types/transport";

/** Generates a simple 2-2 layout scaled to the vehicle's capacity — one
 * attendant seat up front, an emergency exit mid-row, wheelchair space at
 * the back. Shared between seed generation and the vehicle service so a
 * newly created vehicle gets the same layout shape as the seeded fleet. */
export function buildSeatsForVehicle(vehicle: Vehicle): VehicleSeat[] {
  const seats: VehicleSeat[] = [];
  const rows = Math.ceil(vehicle.capacity / 4);
  let seatIndex = 0;
  for (let row = 1; row <= rows && seatIndex < vehicle.capacity; row++) {
    for (let col = 1; col <= 4 && seatIndex < vehicle.capacity; col++) {
      seatIndex += 1;
      let type: VehicleSeat["type"] = "standard";
      if (row === 1 && col === 1) type = "attendant";
      else if (row === rows && (col === 1 || col === 2)) type = "wheelchair";
      else if (row === Math.ceil(rows / 2) && col === 3) type = "emergency-exit";
      seats.push({ id: `${vehicle.id}-seat-${seatIndex}`, vehicleId: vehicle.id, seatNumber: `${row}${String.fromCharCode(64 + col)}`, row, column: col, type });
    }
  }
  return seats;
}
