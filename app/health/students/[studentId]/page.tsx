"use client";

// Student health detail (Phase 9R) — real PostgreSQL/API cutover for
// Overview/Visits/Medications. Incidents and Immunisation stay honestly
// deferred (no real Incident/Vaccination model exists — see
// route-mock-guard.test.ts for the full reasoning).
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PrivacyNotice, RestrictedHealth, SensitiveBadge } from "@/components/campus/privacy";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentDetail } from "@/lib/hooks/api/use-students";
import { upsertStudentHealthProfileRequest, useStudentHealthProfile } from "@/lib/hooks/api/use-health-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { HealthVisitStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusLabel: Record<HealthVisitStatusDto, string> = { open: "Open", closed: "Closed", referred: "Referred" };

export default function StudentHealthProfilePage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: student } = useStudentDetail(studentId);
  const { data: health, loading, reload } = useStudentHealthProfile(studentId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bloodGroup: "", allergiesText: "", chronicConditionsText: "", careInstructions: "", physicianName: "", physicianPhone: "", insuranceProvider: "", insuranceNumberMasked: "" });

  if (!capabilitiesLoading && !hasServerPermission("health.view")) return <PermissionDenied action="view student health" role={roleLabels[role]} backHref="/health/students" />;
  if (!loading && !student) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Student not found. <Link href="/health/students" className="text-primary">Back</Link></div>;
  if (!student) return null;

  const canSensitive = hasServerPermission("health.viewSensitive");
  const canManage = hasServerPermission("health.manage");
  const profile = health?.profile;

  function openEdit() {
    if (!profile) return;
    setForm({
      bloodGroup: profile.bloodGroup ?? "", allergiesText: profile.allergiesText ?? "", chronicConditionsText: profile.chronicConditionsText ?? "",
      careInstructions: profile.careInstructions ?? "", physicianName: profile.physicianName ?? "", physicianPhone: profile.physicianPhone ?? "",
      insuranceProvider: profile.insuranceProvider ?? "", insuranceNumberMasked: profile.insuranceNumberMasked ?? "",
    });
    setEditing(true);
  }
  async function saveProfile() {
    await upsertStudentHealthProfileRequest(studentId, {
      bloodGroup: form.bloodGroup || null, allergiesText: form.allergiesText || null, chronicConditionsText: form.chronicConditionsText || null,
      careInstructions: form.careInstructions || null, physicianName: form.physicianName || null, physicianPhone: form.physicianPhone || null,
      insuranceProvider: form.insuranceProvider || null, insuranceNumberMasked: form.insuranceNumberMasked || null,
    });
    setEditing(false);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/health/students"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0"><h1 className="truncate text-lg font-semibold text-foreground">{student.fullName}</h1><p className="truncate text-xs text-muted-foreground">{student.admissionNumber} · {student.classLabel}{student.sectionLabel ? `-${student.sectionLabel}` : ""}</p></div>
      </div>
      <PrivacyNotice />

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visits">Visits ({health?.recentVisits.length ?? 0})</TabsTrigger>
          <TabsTrigger value="medications">Medications ({health?.medicationHistory.length ?? 0})</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="immunisation">Immunisation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-md">
          {!canSensitive ? <RestrictedHealth label="health overview" /> : (
            <div className="flex flex-col gap-sm">
              {canManage && <Button size="sm" variant="outline" className="w-fit" onClick={openEdit}>Edit profile</Button>}
              <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                <Card title="Emergency contact">
                  {health && health.emergencyContacts.length > 0 ? health.emergencyContacts.map((c, i) => <p key={i} className="text-sm text-foreground">{c.name} <span className="text-xs text-muted-foreground">({c.relation}) {c.phone ?? ""}</span></p>) : <p className="text-sm text-muted-foreground">No emergency contact on file.</p>}
                </Card>
                <Card title="Blood group & allergies"><p className="flex items-center gap-2 text-sm text-foreground">{profile?.bloodGroup ?? "Not recorded"} <SensitiveBadge /></p>{profile?.allergiesText && <p className="mt-1 text-xs text-warning">Allergies: {profile.allergiesText}</p>}</Card>
                <Card title="Care instructions"><p className="text-sm text-muted-foreground">{profile?.careInstructions ?? "None recorded"}</p></Card>
                <Card title="Physician"><p className="text-sm text-foreground">{profile?.physicianName ?? "—"}</p><p className="text-xs text-muted-foreground">{profile?.physicianPhone ?? ""}</p></Card>
                <Card title="Insurance"><p className="text-sm text-foreground">{profile?.insuranceProvider ?? "Not configured"} {profile?.insuranceNumberMasked ?? ""}</p></Card>
                <Card title="Last updated"><p className="text-sm text-muted-foreground">{profile?.updatedAt ? formatDate(profile.updatedAt) : "Never"}</p></Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="visits" className="mt-md">
          {!canSensitive ? <RestrictedHealth label="visit history" /> : !health || health.recentVisits.length === 0 ? <Empty /> : (
            <div className="flex flex-col gap-xs">{health.recentVisits.map((v) => (
              <div key={v.id} className="rounded-md border border-border bg-surface p-sm text-sm"><div className="flex items-center justify-between gap-sm"><span className="text-foreground">{v.reason}</span><Badge tone="neutral">{statusLabel[v.status]}</Badge></div><p className="text-xs text-muted-foreground">{formatDate(v.checkedInAt)} · {v.attendedByStaffName ?? "Unattended"}{v.careAction ? ` · ${v.careAction}` : ""}</p></div>
            ))}</div>
          )}
        </TabsContent>

        <TabsContent value="medications" className="mt-md">
          {!canSensitive ? <RestrictedHealth label="medication records" /> : !health || health.medicationHistory.length === 0 ? <Empty /> : (
            <div className="flex flex-col gap-xs">{health.medicationHistory.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm"><span className="min-w-0 truncate text-foreground">{m.medicationName}{m.quantity ? ` · ${m.quantity}${m.unit ?? ""}` : ""}</span><span className="text-xs text-muted-foreground">{formatDate(m.administeredAt)}</span></div>
            ))}</div>
          )}
        </TabsContent>

        <TabsContent value="incidents" className="mt-md">
          <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Incident reporting is not yet linked to a real backing system.</div>
        </TabsContent>

        <TabsContent value="immunisation" className="mt-md">
          <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Immunisation records are not yet linked to a real backing system.</div>
        </TabsContent>
      </Tabs>

      <DetailDrawer open={editing} onOpenChange={setEditing} title="Edit health profile" description={student.fullName}>
        <div className="flex flex-col gap-md">
          <div className="grid grid-cols-2 gap-sm">
            <div className="flex flex-col gap-1.5"><Label htmlFor="bg">Blood group</Label><Input id="bg" value={form.bloodGroup} onChange={(e) => setForm((f) => ({ ...f, bloodGroup: e.target.value }))} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="phy">Physician</Label><Input id="phy" value={form.physicianName} onChange={(e) => setForm((f) => ({ ...f, physicianName: e.target.value }))} /></div>
          </div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="al">Allergies</Label><Input id="al" value={form.allergiesText} onChange={(e) => setForm((f) => ({ ...f, allergiesText: e.target.value }))} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="cc">Chronic conditions</Label><Input id="cc" value={form.chronicConditionsText} onChange={(e) => setForm((f) => ({ ...f, chronicConditionsText: e.target.value }))} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="ci">Care instructions</Label><Input id="ci" value={form.careInstructions} onChange={(e) => setForm((f) => ({ ...f, careInstructions: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-sm">
            <div className="flex flex-col gap-1.5"><Label htmlFor="pp">Physician phone</Label><Input id="pp" value={form.physicianPhone} onChange={(e) => setForm((f) => ({ ...f, physicianPhone: e.target.value }))} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="ins">Insurance provider</Label><Input id="ins" value={form.insuranceProvider} onChange={(e) => setForm((f) => ({ ...f, insuranceProvider: e.target.value }))} /></div>
          </div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="insn">Insurance number (masked)</Label><Input id="insn" value={form.insuranceNumberMasked} onChange={(e) => setForm((f) => ({ ...f, insuranceNumberMasked: e.target.value }))} /></div>
          <div className="flex justify-end gap-xs"><Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button onClick={saveProfile}>Save</Button></div>
        </div>
      </DetailDrawer>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-lg border border-border bg-surface p-md"><h3 className="mb-sm text-sm font-semibold text-foreground">{title}</h3>{children}</div>; }
function Empty() { return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No records.</div>; }
