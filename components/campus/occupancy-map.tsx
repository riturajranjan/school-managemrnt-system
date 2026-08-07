"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HostelRoom, RoomStatus } from "@/lib/types/hostel";

const statusColor: Record<RoomStatus, string> = {
  available: "#047857",
  partial: "#b45309",
  full: "#18b0c8",
  maintenance: "#be123c",
  reserved: "#7c3aed",
  closed: "#64748b",
};

/** Lightweight dimensional occupancy map — layered CSS/SVG room tiles grouped
 * by floor, with a subtle isometric lift. No WebGL. Click a room to open its
 * drawer. Falls back to a plain grid on small screens (parent controls layout). */
export function OccupancyMap({ floors, rooms, occupiedByRoom, onRoomClick }: {
  floors: { id: string; name: string }[];
  rooms: HostelRoom[];
  occupiedByRoom: (roomId: string) => number;
  onRoomClick: (room: HostelRoom) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-md">
      {floors.map((floor, fi) => {
        const floorRooms = rooms.filter((r) => r.floorId === floor.id);
        if (floorRooms.length === 0) return null;
        return (
          <div key={floor.id}>
            <p className="mb-xs text-xs font-semibold uppercase tracking-wide text-muted-foreground">{floor.name}</p>
            <div className="flex flex-wrap gap-2">
              {floorRooms.map((room, ri) => {
                const occ = occupiedByRoom(room.id);
                return (
                  <motion.button
                    key={room.id}
                    type="button"
                    onClick={() => onRoomClick(room)}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduce ? 0 : (fi * 6 + ri) * 0.01, duration: 0.2 }}
                    className="group relative flex h-16 w-16 flex-col items-center justify-center rounded-md border text-center shadow-card outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-1"
                    style={{ borderColor: statusColor[room.status], background: `linear-gradient(155deg, ${statusColor[room.status]}22, ${statusColor[room.status]}0d)` }}
                    aria-label={`Room ${room.roomNumber}, ${room.status}, ${occ} of ${room.capacity} beds occupied`}
                  >
                    <span className="text-sm font-bold text-foreground">{room.roomNumber}</span>
                    <span className="text-[10px]" style={{ color: statusColor[room.status] }}>{occ}/{room.capacity}</span>
                    <span className="absolute right-1 top-1 size-1.5 rounded-pill" style={{ background: statusColor[room.status] }} aria-hidden="true" />
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.keys(statusColor) as RoomStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1 capitalize text-muted-foreground"><span className="size-2 rounded-pill" style={{ background: statusColor[s] }} /> {s}</span>
        ))}
      </div>
    </div>
  );
}
