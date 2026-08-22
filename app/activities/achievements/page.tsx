"use client";

// Achievements (Phase 9U) — real StudentAchievement: title, description,
// awardedAt, optional Activity link, real Student. The mock's level/
// position/category/points had no real backing (no scoring/ranking model
// in this phase) and are dropped rather than fabricated.
import { useMemo, useState } from "react";
import { Award, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { createStudentAchievementRequest, useActivities, useStudentAchievements } from "@/lib/hooks/api/use-activities-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function AchievementsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const { data: achievements, reload } = useStudentAchievements();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? achievements.filter((a) => a.title.toLowerCase().includes(q)) : achievements;
  }, [achievements, query]);

  if (!capabilitiesLoading && !hasServerPermission("activities.view")) return <PermissionDenied action="view achievements" role={roleLabels[role]} backHref="/activities" />;
  const canManage = hasServerPermission("activities.manage");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Achievements</h1><p className="text-xs text-muted-foreground">{achievements.length} achievements recorded</p></div>
        {canManage && <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5" /> Record achievement</Button>}
      </div>

      <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search achievements…" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>

      <div className="flex flex-col gap-xs">
        {filtered.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="flex items-start gap-2"><span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary"><Award className="size-4" /></span><div className="min-w-0"><p className="truncate font-medium text-foreground">{a.title}</p><p className="truncate text-xs text-muted-foreground">{a.activityName ? `${a.activityName} · ` : ""}{formatDate(a.awardedAt)}</p>{a.description && <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>}</div></div>
          </div>
        ))}
        {filtered.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No achievements match your filters.</div>}
      </div>

      <RecordAchievementDrawer open={adding} onOpenChange={setAdding} onDone={() => { setAdding(false); reload(); }} />
    </div>
  );
}

function RecordAchievementDrawer({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [studentQuery, setStudentQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const { data: students } = useStudentList({ status: ["active"], pageSize: 300 });
  const { data: activities } = useActivities({});
  const [activityId, setActivityId] = useState<string>("none");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [awardedAt, setAwardedAt] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const matches = studentQuery.trim() && !studentId ? students.filter((s) => s.fullName.toLowerCase().includes(studentQuery.trim().toLowerCase())).slice(0, 6) : [];
  const selectedStudent = students.find((s) => s.id === studentId);

  async function submit() {
    if (!studentId || !title.trim() || !awardedAt) return;
    const res = await createStudentAchievementRequest({ studentId, activityId: activityId === "none" ? undefined : activityId, title, description: description || undefined, awardedAt });
    if (!res.success) { setError(res.error.message); return; }
    onDone();
  }

  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="Record achievement" description="Factual record only — no score, rank, or certificate">
      <div className="flex flex-col gap-md">
        <div>
          <Label>Student *</Label>
          {selectedStudent ? (
            <div className="flex items-center justify-between rounded-md border border-border p-sm text-sm"><span>{selectedStudent.fullName}</span><Button size="sm" variant="ghost" onClick={() => { setStudentId(""); setStudentQuery(""); }}>Change</Button></div>
          ) : (
            <>
              <Input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Search student…" />
              <div className="mt-1 flex flex-col gap-1">{matches.map((s) => <button key={s.id} onClick={() => setStudentId(s.id)} className="rounded-md border border-border p-sm text-left text-sm hover:border-primary/40">{s.fullName}</button>)}</div>
            </>
          )}
        </div>
        <div>
          <Label>Related activity (optional)</Label>
          <Select value={activityId} onValueChange={setActivityId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">None</SelectItem>{activities.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="ach-title">Title *</Label><Input id="ach-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Won inter-school debate" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="ach-date">Date *</Label><Input id="ach-date" type="date" value={awardedAt} onChange={(e) => setAwardedAt(e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="ach-desc">Description</Label><Textarea id="ach-desc" value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} rows={2} /></div>
        {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}
        <div className="flex justify-end gap-xs"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={!studentId || !title.trim()}>Save</Button></div>
      </div>
    </DetailDrawer>
  );
}
