// Hostel Rooms + Beds (Phase 9Q). Capacity is never a stored field — a room
// is created WITH its beds (provisioned atomically in the same transaction),
// so `capacity` is always `beds.length` and occupancy is always derived from
// the active-assignment partial-unique-index invariant. No decorative
// Block/Floor entity — `floorNumber` is a plain display field on the room.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HostelBedDto, HostelRoomDto } from "@/lib/api/contracts";
import { requireHostelInScope } from "./hostels";
import { studentDisplayName } from "./access";

type RoomRow = {
  id: string; hostelId: string; roomNumber: string; floorNumber: number | null; roomType: string | null;
  facilities: string[]; notes: string | null; status: string; createdAt: Date; updatedAt: Date;
  hostel: { name: string };
  beds: { id: string; status: string }[];
};

const roomSelect = {
  id: true, hostelId: true, roomNumber: true, floorNumber: true, roomType: true, facilities: true, notes: true, status: true, createdAt: true, updatedAt: true,
  hostel: { select: { name: true } },
  beds: { select: { id: true, status: true } },
} satisfies Prisma.HostelRoomSelect;

async function roomDto(scope: OrgScope, r: RoomRow): Promise<HostelRoomDto> {
  const activeBedIds = r.beds.filter((b) => b.status === "ACTIVE").map((b) => b.id);
  const occupiedCount = activeBedIds.length
    ? await prisma.studentHostelAssignment.count({ where: { bedId: { in: activeBedIds }, status: "ACTIVE" } })
    : 0;
  return {
    id: r.id, hostelId: r.hostelId, hostelName: r.hostel.name, roomNumber: r.roomNumber, floorNumber: r.floorNumber,
    roomType: r.roomType, facilities: r.facilities, notes: r.notes, status: r.status.toLowerCase() as HostelRoomDto["status"],
    totalBeds: r.beds.length, activeBeds: activeBedIds.length, occupiedBeds: occupiedCount, availableBeds: Math.max(0, activeBedIds.length - occupiedCount),
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listRooms(scope: OrgScope, params: { hostelId?: string; status?: string } = {}): Promise<HostelRoomDto[]> {
  const where: Prisma.HostelRoomWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.hostelId) where.hostelId = params.hostelId;
  if (params.status) where.status = params.status.toUpperCase() as never;
  const rows = await prisma.hostelRoom.findMany({ where, select: roomSelect, orderBy: [{ floorNumber: "asc" }, { roomNumber: "asc" }] });
  return Promise.all(rows.map((r) => roomDto(scope, r)));
}

async function requireRoomRow(scope: OrgScope, roomId: string): Promise<RoomRow> {
  const row = await prisma.hostelRoom.findFirst({ where: { id: roomId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: roomSelect });
  if (!row) throw new HttpError("HOSTEL_ROOM_NOT_FOUND", "Room not found");
  return row;
}

export async function getRoom(scope: OrgScope, roomId: string): Promise<HostelRoomDto> {
  return roomDto(scope, await requireRoomRow(scope, roomId));
}

export async function requireRoomInScope(scope: OrgScope, roomId: string): Promise<{ id: string; hostelId: string }> {
  const r = await prisma.hostelRoom.findFirst({ where: { id: roomId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, hostelId: true } });
  if (!r) throw new HttpError("HOSTEL_ROOM_NOT_FOUND", "Room not found");
  return r;
}

export const createRoomSchema = z.object({
  hostelId: z.string().min(1),
  roomNumber: z.string().trim().min(1).max(24),
  floorNumber: z.number().int().min(0).max(200).optional(),
  roomType: z.string().trim().max(40).optional(),
  facilities: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  notes: z.string().trim().max(500).optional(),
  capacity: z.number().int().min(1).max(20),
});

export async function createRoom(scope: OrgScope, raw: unknown): Promise<HostelRoomDto> {
  const input = parseInput(createRoomSchema, raw);
  const branchId = (await requireHostelInScope(scope, input.hostelId)).branchId;

  let roomId: string;
  try {
    roomId = await prisma.$transaction(async (tx) => {
      const room = await tx.hostelRoom.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, hostelId: input.hostelId,
          roomNumber: input.roomNumber, floorNumber: input.floorNumber, roomType: input.roomType,
          facilities: input.facilities ?? [], notes: input.notes,
        },
        select: { id: true },
      });
      await tx.hostelBed.createMany({
        data: Array.from({ length: input.capacity }, (_, i) => ({
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, roomId: room.id, bedNumber: String(i + 1),
        })),
      });
      await recordAudit(tx, scope, "HOSTEL_ROOM_CREATED", "HostelRoom", room.id, { roomNumber: input.roomNumber, capacity: input.capacity });
      return room.id;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("HOSTEL_ROOM_NUMBER_EXISTS", "A room with this number already exists in this hostel");
    throw e;
  }
  return getRoom(scope, roomId);
}

export const updateRoomSchema = z.object({
  floorNumber: z.number().int().min(0).max(200).nullable().optional(),
  roomType: z.string().trim().max(40).nullable().optional(),
  facilities: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["active", "maintenance", "archived"]).optional(),
});

export async function updateRoom(scope: OrgScope, roomId: string, raw: unknown): Promise<HostelRoomDto> {
  const input = parseInput(updateRoomSchema, raw);
  await requireRoomRow(scope, roomId);
  await prisma.hostelRoom.update({
    where: { id: roomId },
    data: {
      floorNumber: input.floorNumber, roomType: input.roomType, facilities: input.facilities, notes: input.notes,
      status: input.status ? (input.status.toUpperCase() as never) : undefined,
    },
  });
  await recordAudit(prisma, scope, "HOSTEL_ROOM_UPDATED", "HostelRoom", roomId, input);
  return getRoom(scope, roomId);
}

// ── Beds ─────────────────────────────────────────────────────────────────

type BedRow = {
  id: string; roomId: string; bedNumber: string; status: string; createdAt: Date; updatedAt: Date;
  room: { roomNumber: string; hostelId: string; hostel: { name: string } };
  assignments: { studentId: string; student: { firstName: string; lastName: string | null } }[];
};

const bedSelect = {
  id: true, roomId: true, bedNumber: true, status: true, createdAt: true, updatedAt: true,
  room: { select: { roomNumber: true, hostelId: true, hostel: { select: { name: true } } } },
  assignments: { where: { status: "ACTIVE" }, select: { studentId: true, student: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.HostelBedSelect;

function bedDto(b: BedRow): HostelBedDto {
  const active = b.assignments[0] ?? null;
  return {
    id: b.id, roomId: b.roomId, roomNumber: b.room.roomNumber, hostelId: b.room.hostelId, hostelName: b.room.hostel.name,
    bedNumber: b.bedNumber, status: b.status.toLowerCase() as HostelBedDto["status"],
    occupied: Boolean(active), occupantStudentId: active?.studentId ?? null, occupantName: active ? studentDisplayName(active.student) : null,
    createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString(),
  };
}

export async function listBeds(scope: OrgScope, params: { roomId?: string; hostelId?: string; status?: string; search?: string } = {}): Promise<HostelBedDto[]> {
  const where: Prisma.HostelBedWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.roomId) where.roomId = params.roomId;
  if (params.hostelId) where.room = { hostelId: params.hostelId };
  if (params.status) where.status = params.status.toUpperCase() as never;
  const rows = await prisma.hostelBed.findMany({ where, select: bedSelect, orderBy: { bedNumber: "asc" } });
  let dtos = rows.map(bedDto);
  if (params.search?.trim()) {
    const q = params.search.trim().toLowerCase();
    dtos = dtos.filter((d) => d.roomNumber.toLowerCase().includes(q) || (d.occupantName ?? "").toLowerCase().includes(q));
  }
  return dtos;
}

export async function requireBedInScope(scope: OrgScope, bedId: string): Promise<{ id: string; roomId: string; status: string }> {
  const b = await prisma.hostelBed.findFirst({ where: { id: bedId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, roomId: true, status: true } });
  if (!b) throw new HttpError("HOSTEL_BED_NOT_FOUND", "Bed not found");
  return b;
}

export async function getBed(scope: OrgScope, bedId: string): Promise<HostelBedDto> {
  const row = await prisma.hostelBed.findFirst({ where: { id: bedId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: bedSelect });
  if (!row) throw new HttpError("HOSTEL_BED_NOT_FOUND", "Bed not found");
  return bedDto(row);
}

export const setBedStatusSchema = z.object({ status: z.enum(["active", "maintenance", "archived"]) });

export async function setBedStatus(scope: OrgScope, bedId: string, raw: unknown): Promise<HostelBedDto> {
  const input = parseInput(setBedStatusSchema, raw);
  await requireBedInScope(scope, bedId);
  if (input.status !== "active") {
    const activeAssignment = await prisma.studentHostelAssignment.findFirst({ where: { bedId, status: "ACTIVE" }, select: { id: true } });
    if (activeAssignment) throw new HttpError("HOSTEL_BED_NOT_AVAILABLE", "This bed has an active resident — vacate or transfer first");
  }
  await prisma.hostelBed.update({ where: { id: bedId }, data: { status: input.status.toUpperCase() as never } });
  await recordAudit(prisma, scope, "HOSTEL_BED_UPDATED", "HostelBed", bedId, { status: input.status });
  return getBed(scope, bedId);
}
