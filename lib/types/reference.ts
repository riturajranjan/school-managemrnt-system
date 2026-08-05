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

export type TransportRoute = {
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
