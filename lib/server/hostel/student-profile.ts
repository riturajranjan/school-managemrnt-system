// Student 360 Hostel tab (Phase 9Q) — real current assignment + history,
// mirroring getStudentLibraryProfile/getStudentTransportProfile exactly.
// Never a fake fee balance.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { StudentHostelProfileDto } from "@/lib/api/contracts";
import { staffDisplayName } from "./access";

export async function getStudentHostelProfile(scope: OrgScope, studentId: string): Promise<StudentHostelProfileDto> {
  const rows = await prisma.studentHostelAssignment.findMany({
    where: { studentId, schoolId: scope.schoolId },
    select: {
      id: true, hostelId: true, roomId: true, bedId: true, assignedAt: true, vacatedAt: true, status: true,
      hostel: { select: { name: true } }, room: { select: { roomNumber: true } }, bed: { select: { bedNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const current = rows.find((r) => r.status === "ACTIVE") ?? null;
  const warden = current
    ? await prisma.hostelStaffAssignment.findFirst({
        where: { hostelId: current.hostelId, role: "WARDEN", status: "ACTIVE" },
        select: { staff: { select: { firstName: true, lastName: true, displayName: true } } },
      })
    : null;

  const map = (r: (typeof rows)[number]) => ({
    id: r.id, hostelName: r.hostel.name, roomNumber: r.room.roomNumber, bedNumber: r.bed.bedNumber,
    assignedAt: r.assignedAt.toISOString(), vacatedAt: r.vacatedAt?.toISOString() ?? null,
    status: r.status.toLowerCase() as "active" | "vacated" | "transferred",
  });

  return {
    current: current ? { ...map(current), wardenName: warden ? staffDisplayName(warden.staff) : null } : null,
    history: rows.filter((r) => r.status !== "ACTIVE").map(map),
  };
}
