import type { FeeStructure, HostelBlock, SchoolClass, StaffMemberRef, TransportRouteRef } from "@/lib/types/reference";
import { staffNames } from "./names";

const classNames = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

export const CURRENT_SESSION = "2026-2027";

export const schoolClasses: SchoolClass[] = classNames.map((name, index) => {
  const classId = `class-${name.toLowerCase()}`;
  const sectionNames = index < 6 ? ["A", "B"] : ["A", "B", "C"];
  return {
    id: classId,
    name: `Class ${name}`,
    order: index + 1,
    capacityPerSection: 32,
    sections: sectionNames.map((sectionName) => ({
      id: `${classId}-${sectionName.toLowerCase()}`,
      classId,
      name: sectionName,
      capacity: 32,
      // Deterministic pseudo-fill so the UI shows meaningful (not-all-full,
      // not-all-empty) capacity warnings without randomness.
      enrolledCount: 18 + ((index * 7 + sectionName.charCodeAt(0)) % 15),
      classTeacher: staffNames[(index + sectionName.charCodeAt(0)) % staffNames.length],
    })),
  };
});

export function findClass(classId: string): SchoolClass | undefined {
  return schoolClasses.find((c) => c.id === classId);
}

export function findSection(sectionId: string): { section: SchoolClass["sections"][number]; schoolClass: SchoolClass } | undefined {
  for (const schoolClass of schoolClasses) {
    const section = schoolClass.sections.find((s) => s.id === sectionId);
    if (section) return { section, schoolClass };
  }
  return undefined;
}

export const feeStructures: FeeStructure[] = schoolClasses.map((schoolClass) => ({
  id: `fee-${schoolClass.id}`,
  name: `${schoolClass.name} — Standard`,
  classId: schoolClass.id,
  session: CURRENT_SESSION,
  totalAmount: 42000 + schoolClass.order * 3200,
  installments: 4,
}));

export const transportRoutes: TransportRouteRef[] = [
  { id: "route-1", name: "Route 1 — Indiranagar", stops: ["Indiranagar", "Domlur", "HAL"], vehicleNumber: "KA-05-AB-1234", capacity: 45, occupied: 38, monthlyFee: 2400 },
  { id: "route-2", name: "Route 2 — Whitefield", stops: ["Whitefield", "Marathahalli", "Brookefield"], vehicleNumber: "KA-05-AB-5678", capacity: 45, occupied: 41, monthlyFee: 2800 },
  { id: "route-3", name: "Route 3 — Koramangala", stops: ["Koramangala", "BTM Layout", "Jayanagar"], vehicleNumber: "KA-05-AB-9012", capacity: 45, occupied: 29, monthlyFee: 2200 },
  { id: "route-4", name: "Route 4 — Hebbal", stops: ["Hebbal", "RT Nagar", "Yeshwanthpur"], vehicleNumber: "KA-05-AB-3456", capacity: 45, occupied: 44, monthlyFee: 2600 },
];

export const hostelBlocks: HostelBlock[] = [
  { id: "hostel-boys", name: "Aravali Block (Boys)", type: "boys", capacity: 80, occupied: 61, monthlyFee: 9500 },
  { id: "hostel-girls", name: "Nilgiri Block (Girls)", type: "girls", capacity: 80, occupied: 68, monthlyFee: 9500 },
];

export const staffMembers: StaffMemberRef[] = staffNames.map((name, index) => ({
  id: `staff-${index + 1}`,
  name,
  role: index % 3 === 0 ? "Admission Officer" : index % 3 === 1 ? "Front Office" : "Coordinator",
}));

export const admissionOfficers: StaffMemberRef[] = staffMembers.filter((_, index) => index % 3 === 0);
