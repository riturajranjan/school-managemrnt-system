// Shared reference/lookup data: classes, sections, fee structures, transport
// routes, hostels — the "master data" admissions and students both hang off.
import type { ID } from "./common";

export type SchoolClass = {
  id: ID;
  name: string;
  order: number;
  sections: ClassSection[];
  capacityPerSection: number;
};

export type ClassSection = {
  id: ID;
  classId: ID;
  name: string;
  capacity: number;
  enrolledCount: number;
  classTeacher?: string;
};

export type FeeStructure = {
  id: ID;
  name: string;
  classId: ID;
  session: string;
  totalAmount: number;
  installments: number;
};

/** A minimal lookup shape used only by the admissions intake dropdown — the
 * Phase 6 transport module owns the real `TransportRoute` entity (see
 * lib/types/transport.ts). */
export type TransportRouteRef = {
  id: ID;
  name: string;
  stops: string[];
  vehicleNumber: string;
  capacity: number;
  occupied: number;
  monthlyFee: number;
};

export type HostelBlock = {
  id: ID;
  name: string;
  type: "boys" | "girls" | "co-ed";
  capacity: number;
  occupied: number;
  monthlyFee: number;
};

export type StaffMemberRef = {
  id: ID;
  name: string;
  role: string;
};
