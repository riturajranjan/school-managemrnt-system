"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrivacyNotice, RestrictedHealth, SensitiveBadge } from "@/components/campus/privacy";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { incidentStatusTone, incidentTypeLabels, medicationStatusLabels, medicationStatusTone, visitStatusLabels } from "@/lib/types/health";
import { formatDate } from "@/lib/utils";

export default function StudentHealthProfilePage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();

  const student = db.students.find((s) => s.id === studentId);
  if (!can("health.view")) return <PermissionDenied action="view student health" role={roleLabels[role]} backHref="/health/students" />;
  if (!student) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Student not found. <Link href="/health/students" className="text-primary">Back</Link></div>;

  const canSensitive = can("health.viewSensitive");
  const profile = db.healthProfiles.find((p) => p.studentId === studentId);
  const visits = db.healthVisits.filter((v) => v.studentId === studentId).sort((a, b) => b.arrivalAt.localeCompare(a.arrivalAt));
  const incidents = db.healthIncidents.filter((i) => i.studentId === studentId);
  const meds = db.medicationRecords.filter((m) => m.studentId === studentId);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/health/students"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0"><h1 className="truncate text-lg font-semibold text-foreground">{student.profile.firstName} {student.profile.lastName}</h1><p className="truncate text-xs text-muted-foreground">{student.admissionNumber} · {student.classId}</p></div>
      </div>
      <PrivacyNotice />

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visits">Visits ({visits.length})</TabsTrigger>
          <TabsTrigger value="medications">Medications ({meds.length})</TabsTrigger>
          <TabsTrigger value="incidents">Incidents ({incidents.length})</TabsTrigger>
          <TabsTrigger value="immunisation">Immunisation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-md">
          {!canSensitive ? <RestrictedHealth label="health overview" /> : profile ? (
            <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
              <Card title="Emergency contact"><p className="text-sm text-foreground">{profile.emergencyContactName}</p><p className="text-xs text-muted-foreground">{profile.emergencyContactPhone}</p></Card>
              <Card title="Blood group & allergies"><p className="flex items-center gap-2 text-sm text-foreground">{profile.bloodGroup ?? "Not recorded"} <SensitiveBadge /></p>{profile.allergies.length > 0 && <p className="mt-1 text-xs text-warning">Allergies: {profile.allergies.join(", ")}</p>}</Card>
              <Card title="Care instructions"><p className="text-sm text-muted-foreground">{profile.careInstructions ?? "None recorded"}</p></Card>
              <Card title="Physician"><p className="text-sm text-foreground">{profile.physicianName ?? "—"}</p><p className="text-xs text-muted-foreground">{profile.physicianPhone ?? ""}</p></Card>
              <Card title="Insurance"><p className="text-sm text-foreground">{profile.insuranceProvider ?? "Not configured"} {profile.insuranceNumberMasked ?? ""}</p></Card>
              <Card title="Last updated"><p className="text-sm text-muted-foreground">{formatDate(profile.lastUpdated)}</p></Card>
            </div>
          ) : <p className="text-sm text-muted-foreground">No health profile on file.</p>}
        </TabsContent>

        <TabsContent value="visits" className="mt-md">
          {!canSensitive ? <RestrictedHealth label="visit history" /> : visits.length === 0 ? <Empty /> : (
            <div className="flex flex-col gap-xs">{visits.map((v) => (
              <div key={v.id} className="rounded-md border border-border bg-surface p-sm text-sm"><div className="flex items-center justify-between gap-sm"><span className="text-foreground">{v.reason}</span><Badge tone="neutral">{visitStatusLabels[v.status]}</Badge></div><p className="text-xs text-muted-foreground">{formatDate(v.arrivalAt)} · {v.staffName}{v.careAction ? ` · ${v.careAction}` : ""}</p></div>
            ))}</div>
          )}
        </TabsContent>

        <TabsContent value="medications" className="mt-md">
          {!canSensitive ? <RestrictedHealth label="medication records" /> : meds.length === 0 ? <Empty /> : (
            <div className="flex flex-col gap-xs">{meds.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm"><span className="min-w-0 truncate text-foreground">{m.medicationName} · {m.scheduledTime}</span><Badge tone={medicationStatusTone[m.status]}>{medicationStatusLabels[m.status]}</Badge></div>
            ))}</div>
          )}
        </TabsContent>

        <TabsContent value="incidents" className="mt-md">
          {incidents.length === 0 ? <Empty /> : (
            <div className="flex flex-col gap-xs">{incidents.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm"><span className="min-w-0 truncate text-foreground">{incidentTypeLabels[i.type]} · {i.location}</span><Badge tone={incidentStatusTone[i.status]}>{i.status}</Badge></div>
            ))}</div>
          )}
        </TabsContent>

        <TabsContent value="immunisation" className="mt-md">
          {!canSensitive ? <RestrictedHealth label="immunisation records" /> : profile && profile.immunisations.length > 0 ? (
            <div className="flex flex-col gap-xs">{profile.immunisations.map((im, i) => (
              <div key={i} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm"><span className="text-foreground">{im.name}</span><span className="text-xs text-muted-foreground">{formatDate(im.date)} · {im.status}</span></div>
            ))}</div>
          ) : <Empty />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-lg border border-border bg-surface p-md"><h3 className="mb-sm text-sm font-semibold text-foreground">{title}</h3>{children}</div>; }
function Empty() { return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No records.</div>; }
