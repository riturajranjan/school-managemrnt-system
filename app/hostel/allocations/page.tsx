"use client";

// Bed allocation wizard (Phase 9Q) — real PostgreSQL/API cutover. Floor stays
// a client-side grouping step (no real Floor entity) over real rooms.
import { useState } from "react";
import { BedDouble, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { assignHostelStudentRequest, useHostelAssignments, useHostelBeds, useHostelRooms, useHostels } from "@/lib/hooks/api/use-hostel-api";
import { roleLabels } from "@/lib/permissions/roles";

const steps = ["Student", "Hostel", "Floor", "Room", "Bed", "Review"] as const;

export default function AllocationsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [floorNumber, setFloorNumber] = useState<number | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [bedId, setBedId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const { data: students } = useStudentList({ status: ["active"], pageSize: 200 });
  const { data: activeAssignments, reload: reloadAssignments } = useHostelAssignments({ status: "active" });
  const { data: hostels } = useHostels({ status: "active" });
  const { data: rooms } = useHostelRooms({ hostelId: hostelId ?? undefined, status: "active" });
  const { data: beds, reload: reloadBeds } = useHostelBeds({ roomId: roomId ?? undefined, status: "active" });

  if (!capabilitiesLoading && !hasServerPermission("hostel.manage")) return <PermissionDenied action="allocate hostel beds" role={roleLabels[role]} backHref="/hostel" />;

  const allocatedIds = new Set(activeAssignments.map((a) => a.studentId));
  const unallocated = students
    .filter((s) => !allocatedIds.has(s.id))
    .filter((s) => (query.trim() ? s.fullName.toLowerCase().includes(query.trim().toLowerCase()) : true))
    .slice(0, 8);

  const floors = [...new Set(rooms.map((r) => r.floorNumber ?? 0))].sort((a, b) => a - b);
  const roomsOnFloor = floorNumber !== null ? rooms.filter((r) => (r.floorNumber ?? 0) === floorNumber) : [];
  const student = students.find((s) => s.id === studentId);
  const hostel = hostels.find((h) => h.id === hostelId);
  const room = rooms.find((r) => r.id === roomId);
  const bed = beds.find((b) => b.id === bedId);
  const availableBeds = beds.filter((b) => !b.occupied);
  const roommates = roomId ? beds.filter((b) => b.occupied).map((b) => b.occupantName).filter(Boolean) : [];

  async function confirm() {
    if (!studentId || !bedId) return;
    const result = await assignHostelStudentRequest({ studentId, bedId });
    if (result.success) {
      setFlash({ tone: "success", text: `${student?.fullName} allocated to Room ${room?.roomNumber}, Bed ${bed?.bedNumber}.` });
      setStep(0); setStudentId(null); setHostelId(null); setFloorNumber(null); setRoomId(null); setBedId(null);
      reloadAssignments(); reloadBeds();
    } else setFlash({ tone: "error", text: result.error.message });
  }

  const stepValues = [studentId, hostelId, floorNumber, roomId, bedId];
  const canNext = stepValues[step] != null || step === 5;

  return (
    <div className="mx-auto flex w-full  flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Bed allocation</h1>
        <p className="text-xs text-muted-foreground">Assign a student to an available bed</p>
      </div>

      {flash && (
        <div className={`rounded-md border p-sm text-sm ${flash.tone === "success" ? "border-success/30 bg-success/8 text-success" : "border-error/30 bg-error/8 text-error"}`} role="status">
          {flash.text}
        </div>
      )}

      <ol className="flex flex-wrap items-center gap-1 text-xs">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <span className={`flex items-center gap-1 rounded-pill px-2 py-1 font-medium ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/10 text-primary" : "bg-surface-secondary text-muted-foreground"}`}>
              {i < step ? <Check className="size-3" /> : i + 1} {s}
            </span>
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
                <span><span className="block font-medium text-foreground">{s.fullName}</span><span className="block text-xs text-muted-foreground">{s.admissionNumber}</span></span>
                {studentId === s.id && <Check className="size-4 text-primary" />}
              </button>
            ))}
            {unallocated.length === 0 && <p className="text-sm text-muted-foreground">No unallocated students match.</p>}
          </div>
        )}
        {step === 1 && (
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            {hostels.map((h) => (
              <button key={h.id} onClick={() => { setHostelId(h.id); setFloorNumber(null); setRoomId(null); setBedId(null); }} className={`rounded-md border p-sm text-left text-sm ${hostelId === h.id ? "border-primary bg-primary/5" : "border-border"}`}>
                <span className="block font-medium text-foreground">{h.name}</span>
                <span className="block text-xs text-muted-foreground">{h.code}</span>
              </button>
            ))}
          </div>
        )}
        {step === 2 && (
          <div className="flex flex-wrap gap-sm">
            {floors.map((f) => (
              <button key={f} onClick={() => { setFloorNumber(f); setRoomId(null); setBedId(null); }} className={`rounded-md border px-4 py-2 text-sm ${floorNumber === f ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground"}`}>
                {f === 0 ? "Unassigned" : `Floor ${f}`}
              </button>
            ))}
          </div>
        )}
        {step === 3 && (
          <div className="flex flex-wrap gap-sm">
            {roomsOnFloor.map((r) => {
              const full = r.availableBeds <= 0;
              return (
                <button key={r.id} disabled={full} onClick={() => { setRoomId(r.id); setBedId(null); }} className={`flex flex-col items-center rounded-md border px-3 py-2 text-sm disabled:opacity-40 ${roomId === r.id ? "border-primary bg-primary/5" : "border-border"}`}>
                  <span className="font-semibold text-foreground">{r.roomNumber}</span>
                  <span className="text-[10px] text-muted-foreground">{r.occupiedBeds}/{r.activeBeds}</span>
                </button>
              );
            })}
          </div>
        )}
        {step === 4 && (
          <div className="flex flex-col gap-sm">
            {room && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground">{room.roomType ?? "Room"}{room.facilities.length ? ` · ${room.facilities.join(", ")}` : ""}</span>
                <Badge tone={room.status === "active" ? "success" : "warning"}>{room.status}</Badge>
              </div>
            )}
            {roommates.length > 0 && <p className="text-xs text-muted-foreground">Roommates: {roommates.join(", ")}</p>}
            <div className="flex flex-wrap gap-sm">
              {availableBeds.map((b) => (
                <button key={b.id} onClick={() => setBedId(b.id)} className={`flex flex-col items-center gap-1 rounded-md border px-4 py-2 text-sm ${bedId === b.id ? "border-primary bg-primary/5" : "border-border"}`}>
                  <BedDouble className="size-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">Bed {b.bedNumber}</span>
                </button>
              ))}
              {availableBeds.length === 0 && <p className="text-sm text-muted-foreground">No available beds in this room.</p>}
            </div>
          </div>
        )}
        {step === 5 && (
          <div className="flex flex-col gap-sm text-sm">
            <Row label="Student" value={student?.fullName ?? "—"} />
            <Row label="Hostel" value={hostel?.name ?? "—"} />
            <Row label="Room" value={room?.roomNumber ?? "—"} />
            <Row label="Bed" value={bed?.bedNumber ?? "—"} />
            <p className="rounded-md bg-surface-secondary/50 p-sm text-xs text-muted-foreground">
              The system prevents double bed allocation and duplicate active allocations under real database constraints.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between gap-sm">
        {step > 0 ? <Button variant="outline" onClick={() => setStep((s) => s - 1)}><ChevronLeft className="size-4" /> Back</Button> : <span />}
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Next <ChevronRight className="size-4" /></Button>
        ) : (
          <Button onClick={confirm}><Check className="size-4" /> Confirm allocation</Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
