"use client";

import { useState } from "react";
import { BedDouble, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { allocateBed } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { roomStatusLabels, roomStatusTone, roomTypeLabels } from "@/lib/types/hostel";

const steps = ["Student", "Building", "Floor", "Room", "Bed", "Review"] as const;

export default function AllocationsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [floorId, setFloorId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [bedId, setBedId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  if (!can("hostel.allocate")) return <PermissionDenied action="allocate hostel beds" role={roleLabels[role]} backHref="/hostel" />;

  const allocatedIds = new Set(db.hostelAllocations.filter((a) => a.status === "active").map((a) => a.studentId));
  const unallocated = db.students.filter((s) => !allocatedIds.has(s.id)).filter((s) => query.trim() ? `${s.profile.firstName} ${s.profile.lastName}`.toLowerCase().includes(query.trim().toLowerCase()) : true).slice(0, 8);
  const floors = buildingId ? db.hostelFloors.filter((f) => f.buildingId === buildingId).sort((a, b) => a.number - b.number) : [];
  const rooms = floorId ? db.hostelRooms.filter((r) => r.floorId === floorId) : [];
  const beds = roomId ? db.hostelBeds.filter((b) => b.roomId === roomId) : [];
  const student = db.students.find((s) => s.id === studentId);
  const room = db.hostelRooms.find((r) => r.id === roomId);
  const bed = db.hostelBeds.find((b) => b.id === bedId);
  const roommates = roomId ? db.hostelBeds.filter((b) => b.roomId === roomId && b.status === "occupied" && b.studentId).map((b) => db.students.find((s) => s.id === b.studentId)).filter(Boolean) : [];

  function confirm() {
    if (!studentId || !bedId) return;
    const result = allocateBed({ studentId, bedId });
    if (result.ok) { setFlash({ tone: "success", text: `${student?.profile.firstName} allocated to Room ${room?.roomNumber}, Bed ${bed?.position}.` }); setStep(0); setStudentId(null); setBuildingId(null); setFloorId(null); setRoomId(null); setBedId(null); }
    else setFlash({ tone: "error", text: result.error });
  }

  const canNext = [studentId, buildingId, floorId, roomId, bedId][step] != null || step === 5;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Bed allocation</h1>
        <p className="text-xs text-muted-foreground">Assign a student to an available bed</p>
      </div>

      {flash && <div className={`rounded-md border p-sm text-sm ${flash.tone === "success" ? "border-success/30 bg-success/8 text-success" : "border-error/30 bg-error/8 text-error"}`} role="status">{flash.text}</div>}

      <ol className="flex flex-wrap items-center gap-1 text-xs">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <span className={`flex items-center gap-1 rounded-pill px-2 py-1 font-medium ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/10 text-primary" : "bg-surface-secondary text-muted-foreground"}`}>{i < step ? <Check className="size-3" /> : i + 1} {s}</span>
            {i < steps.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-border bg-surface p-md">
        {step === 0 && (
          <div className="flex flex-col gap-sm">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search unallocated students…" aria-label="Search students" />
            {unallocated.map((s) => (
              <button key={s.id} onClick={() => setStudentId(s.id)} className={`flex items-center justify-between rounded-md border p-sm text-left text-sm ${studentId === s.id ? "border-primary bg-primary/5" : "border-border"}`}>
                <span><span className="block font-medium text-foreground">{s.profile.firstName} {s.profile.lastName}</span><span className="block text-xs text-muted-foreground">{s.admissionNumber} · {s.classId}</span></span>
                {studentId === s.id && <Check className="size-4 text-primary" />}
              </button>
            ))}
            {unallocated.length === 0 && <p className="text-sm text-muted-foreground">No unallocated students match.</p>}
          </div>
        )}
        {step === 1 && <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">{db.hostelBuildings.map((b) => (
          <button key={b.id} onClick={() => { setBuildingId(b.id); setFloorId(null); setRoomId(null); setBedId(null); }} className={`rounded-md border p-sm text-left text-sm ${buildingId === b.id ? "border-primary bg-primary/5" : "border-border"}`}><span className="block font-medium text-foreground">{b.name}</span><span className="block text-xs text-muted-foreground">{b.code}</span></button>
        ))}</div>}
        {step === 2 && <div className="flex flex-wrap gap-sm">{floors.map((f) => (
          <button key={f.id} onClick={() => { setFloorId(f.id); setRoomId(null); setBedId(null); }} className={`rounded-md border px-4 py-2 text-sm ${floorId === f.id ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground"}`}>{f.name}</button>
        ))}</div>}
        {step === 3 && <div className="flex flex-wrap gap-sm">{rooms.map((r) => { const occ = db.hostelBeds.filter((b) => b.roomId === r.id && b.status === "occupied").length; const full = occ >= r.capacity || r.status === "maintenance" || r.status === "closed"; return (
          <button key={r.id} disabled={full} onClick={() => { setRoomId(r.id); setBedId(null); }} className={`flex flex-col items-center rounded-md border px-3 py-2 text-sm disabled:opacity-40 ${roomId === r.id ? "border-primary bg-primary/5" : "border-border"}`}><span className="font-semibold text-foreground">{r.roomNumber}</span><span className="text-[10px] text-muted-foreground">{occ}/{r.capacity}</span></button>
        ); })}</div>}
        {step === 4 && (
          <div className="flex flex-col gap-sm">
            {room && <div className="flex items-center justify-between text-sm"><span className="text-foreground">{roomTypeLabels[room.type]} · {room.facilities.join(", ")}</span><Badge tone={roomStatusTone[room.status]}>{roomStatusLabels[room.status]}</Badge></div>}
            {roommates.length > 0 && <p className="text-xs text-muted-foreground">Roommates: {roommates.map((s) => s?.profile.firstName).join(", ")}</p>}
            <div className="flex flex-wrap gap-sm">{beds.map((b) => (
              <button key={b.id} disabled={b.status !== "available"} onClick={() => setBedId(b.id)} className={`flex flex-col items-center gap-1 rounded-md border px-4 py-2 text-sm disabled:opacity-40 ${bedId === b.id ? "border-primary bg-primary/5" : "border-border"}`}><BedDouble className="size-4 text-muted-foreground" /><span className="font-medium text-foreground">Bed {b.position}</span><span className="text-[10px] text-muted-foreground">{b.status}</span></button>
            ))}</div>
          </div>
        )}
        {step === 5 && (
          <div className="flex flex-col gap-sm text-sm">
            <Row label="Student" value={student ? `${student.profile.firstName} ${student.profile.lastName}` : "—"} />
            <Row label="Building" value={db.hostelBuildings.find((b) => b.id === buildingId)?.name ?? "—"} />
            <Row label="Room" value={room?.roomNumber ?? "—"} />
            <Row label="Bed" value={bed?.position ?? "—"} />
            <p className="rounded-md bg-surface-secondary/50 p-sm text-xs text-muted-foreground">The system prevents double bed allocation, blocked/maintenance beds and duplicate active allocations.</p>
          </div>
        )}
      </div>

      <div className="flex justify-between gap-sm">
        {step > 0 ? <Button variant="outline" onClick={() => setStep((s) => s - 1)}><ChevronLeft className="size-4" /> Back</Button> : <span />}
        {step < steps.length - 1 ? <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Next <ChevronRight className="size-4" /></Button> : <Button onClick={confirm}><Check className="size-4" /> Confirm allocation</Button>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium text-foreground">{value}</span></div>; }
