"use client";

// Real sections + enrollment (Phase 6-pre). Same list/drawer visual idiom as
// before, now backed by /api/academics/* instead of the mock store. Class-teacher
// assignment (which needs real staff/HR — a future module) is intentionally not
// shown here; this page manages the real Section + Enrollment foundation.
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  createSectionRequest,
  enrollStudentsRequest,
  unenrollRequest,
  useClasses,
  useEnrollableStudents,
  useRoster,
  useSections,
} from "@/lib/hooks/api/use-academics-foundation";
import type { SectionDto } from "@/lib/api/contracts";

function SectionsInner() {
  const classIdFilter = useSearchParams().get("classId") ?? undefined;
  const { can } = usePermissions();
  const canManage = can("academics.manageClasses");
  const { data: classes } = useClasses();
  const { data: sections, loading, error, reload } = useSections(classIdFilter);
  const [addOpen, setAddOpen] = useState(false);
  const [classId, setClassId] = useState(classIdFilter ?? "");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("40");
  const [rosterSection, setRosterSection] = useState<SectionDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function addSection() {
    setActionError(null);
    const res = await createSectionRequest({ classId, name: name.trim(), capacity: Number(capacity) || 40 });
    if (!res.success) { setActionError(res.error.message); return; }
    setName(""); setAddOpen(false); reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Sections</h1>
          <p className="text-xs text-muted-foreground">Every section across all classes</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { setClassId(classIdFilter ?? ""); setAddOpen(true); }}>
            <Plus className="size-3.5" />
            Add section
          </Button>
        )}
      </div>

      {actionError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}
      {error && !loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load sections: {error}</div>}
      {loading && <div className="py-2xl text-center text-sm text-muted-foreground">Loading sections…</div>}

      {!loading && !error && (
        <div className="flex flex-col gap-sm">
          {sections.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No sections yet.</p>}
          {sections.map((s) => (
            <div key={s.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{s.className} — Section {s.name}</p>
                <p className="text-xs text-muted-foreground">{s.enrolledCount}/{s.capacity} students</p>
              </div>
              <div className="flex items-center gap-sm">
                <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => setRosterSection(s)}>Manage roster</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DetailDrawer open={addOpen} onOpenChange={setAddOpen} title="Add section" description="Create a new section within a class">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger aria-label="Class"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="section-name">Section name</Label>
            <Input id="section-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. C" />
          </div>
          <div>
            <Label htmlFor="section-capacity">Capacity</Label>
            <Input id="section-capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <Button disabled={!classId || !name.trim()} onClick={() => void addSection()}>Add section</Button>
        </div>
      </DetailDrawer>

      <RosterDrawer section={rosterSection} onClose={() => { setRosterSection(null); reload(); }} canManage={canManage} />
    </div>
  );
}

function RosterDrawer({ section, onClose, canManage }: { section: SectionDto | null; onClose: () => void; canManage: boolean }) {
  const { data: roster, loading, reload } = useRoster(section?.id);
  const { data: enrollable, reload: reloadEnrollable } = useEnrollableStudents(Boolean(section));
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rosterRows = useMemo(() => roster ?? [], [roster]);

  async function enroll() {
    if (!section || !selected) return;
    setBusy(true); setErr(null);
    const res = await enrollStudentsRequest(section.id, [selected]);
    setBusy(false);
    if (!res.success) { setErr(res.error.message); return; }
    setSelected(""); reload(); reloadEnrollable();
  }
  async function remove(enrollmentId: string) {
    setBusy(true); setErr(null);
    const res = await unenrollRequest(enrollmentId);
    setBusy(false);
    if (!res.success) { setErr(res.error.message); return; }
    reload(); reloadEnrollable();
  }

  return (
    <DetailDrawer open={Boolean(section)} onOpenChange={(o) => { if (!o) onClose(); }} title={section ? `${section.className} — Section ${section.name}` : ""} description="Manage enrolled students">
      <div className="flex flex-col gap-sm">
        {err && <p className="text-xs text-error">{err}</p>}
        {canManage && (
          <div className="flex items-end gap-sm">
            <div className="flex-1">
              <Label>Enroll student</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger aria-label="Student"><SelectValue placeholder="Select a student" /></SelectTrigger>
                <SelectContent>{(enrollable ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.admissionNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" disabled={busy || !selected} onClick={() => void enroll()}>Enroll</Button>
          </div>
        )}
        {loading ? (
          <p className="py-lg text-center text-sm text-muted-foreground">Loading roster…</p>
        ) : rosterRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No students enrolled.</p>
        ) : (
          <ul className="flex flex-col gap-xs">
            {rosterRows.map((r) => (
              <li key={r.enrollmentId} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
                <div className="min-w-0"><p className="truncate font-medium text-foreground">{r.student.name}</p><p className="truncate text-xs text-muted-foreground">{r.student.admissionNumber}</p></div>
                {canManage && <Button size="sm" variant="ghost" className="text-error" disabled={busy} onClick={() => void remove(r.enrollmentId)}><Trash2 className="size-3.5" /></Button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </DetailDrawer>
  );
}

export default function SectionsPage() {
  return (
    <Suspense fallback={<div className="py-2xl text-center text-sm text-muted-foreground">Loading…</div>}>
      <SectionsInner />
    </Suspense>
  );
}
