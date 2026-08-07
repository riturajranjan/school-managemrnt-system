"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PrivacyNotice } from "@/components/campus/privacy";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { createHealthVisit } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";

export default function NewHealthVisitPage() {
  const db = useSisStore();
  const router = useRouter();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [observation, setObservation] = useState("");
  const [careAction, setCareAction] = useState("");
  const [guardianContacted, setGuardianContacted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!can("health.manage"))
    return (
      <PermissionDenied
        action="record infirmary visits"
        role={roleLabels[role]}
        backHref="/health/visits"
      />
    );

  const matches = query.trim()
    ? db.students
        .filter((s) =>
          `${s.profile.firstName} ${s.profile.lastName}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
        .slice(0, 6)
    : [];
  const selected = db.students.find((s) => s.id === studentId);

  function submit() {
    setError(null);
    if (!studentId) return setError("Select a student.");
    if (!reason.trim()) return setError("Reason for visit is required.");
    const r = createHealthVisit({
      studentId,
      reason,
      symptomsReported: symptoms || undefined,
      observationNotes: observation || undefined,
      careAction: careAction || undefined,
      guardianContacted,
      staffName: "Nurse Anita",
    });
    if (!r.ok) return setError(r.error);
    router.push("/health/infirmary");
  }

  return (
    <div className="mx-auto flex w-full  flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back">
          <Link href="/health/visits">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Record infirmary visit
          </h1>
          <p className="text-xs text-muted-foreground">
            Administrative record only — no diagnosis or prescription
          </p>
        </div>
      </div>
      <PrivacyNotice />
      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        <div className="flex flex-col gap-1.5">
          <Label>Student *</Label>
          {selected ? (
            <div className="flex items-center justify-between rounded-md border border-border p-sm text-sm">
              <span className="font-medium text-foreground">
                {selected.profile.firstName} {selected.profile.lastName} ·{" "}
                {selected.classId}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setStudentId(null);
                  setQuery("");
                }}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search student…"
                aria-label="Search student"
              />
              {matches.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStudentId(s.id)}
                  className="rounded-md border border-border p-sm text-left text-sm hover:border-primary/40">
                  {s.profile.firstName} {s.profile.lastName} · {s.classId}
                </button>
              ))}
            </>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Reason for visit *</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue placeholder="Select reason" />
            </SelectTrigger>
            <SelectContent>
              {[
                "Headache",
                "Stomach ache",
                "Fever",
                "Minor cut",
                "Sprained ankle",
                "Feeling unwell",
                "Nausea",
                "Cold & cough",
                "Other",
              ].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sym">Symptoms as reported</Label>
          <Input
            id="sym"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="As reported by the student"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="obs">Observation notes</Label>
          <Input
            id="obs"
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Objective observations"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Basic school-care action</Label>
          <Select value={careAction} onValueChange={setCareAction}>
            <SelectTrigger>
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              {[
                "Rest provided",
                "Cold compress applied",
                "Water & rest",
                "Guardian informed",
                "Sent back to class",
                "Referred externally",
              ].map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
          <span className="text-sm text-foreground">Guardian contacted</span>
          <Switch
            checked={guardianContacted}
            onCheckedChange={setGuardianContacted}
          />
        </label>
        {error && (
          <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-xs">
          <Button asChild variant="outline">
            <Link href="/health/visits">Cancel</Link>
          </Button>
          <Button onClick={submit}>
            <HeartPulse className="size-4" /> Save visit
          </Button>
        </div>
      </div>
    </div>
  );
}
