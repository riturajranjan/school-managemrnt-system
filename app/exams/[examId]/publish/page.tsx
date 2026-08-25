"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, MessageSquare, Send, Smartphone, UploadCloud, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExam, useResultPublications } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { computePublicationChecklist, publishResults, revokePublication } from "@/lib/services/publication-service";
import type { ResultPublicationChannel, ResultPublicationScope } from "@/lib/types/results";
import { formatDateTime } from "@/lib/utils";

const ACTOR = { name: "Principal", role: "Principal" };
const channelOptions: { key: ResultPublicationChannel; label: string; icon: typeof Mail }[] = [
  { key: "parent-portal", label: "Parent portal", icon: Smartphone },
  { key: "student-portal", label: "Student portal", icon: Smartphone },
  { key: "email", label: "Email", icon: Mail },
  { key: "push", label: "Push notification", icon: MessageSquare },
  { key: "sms", label: "SMS link", icon: MessageSquare },
];

export default function ExamPublishPage() {
  const params = useParams<{ examId: string }>();
  const db = useSisStore();
  const exam = useExam(params.examId);
  const classes = useManagedClasses();
  const publications = useResultPublications(params.examId);
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canPublish = can("results.publish");

  const [scope, setScope] = useState<ResultPublicationScope>("all");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [channels, setChannels] = useState<ResultPublicationChannel[]>(["parent-portal", "student-portal"]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [publishError, setPublishError] = useState<string | null>(null);

  const checklist = useMemo(() => (exam ? computePublicationChecklist(db, exam.id) : []), [db, exam]);
  const allDone = checklist.every((c) => c.done);
  const activePublication = publications.find((p) => p.status === "published" || p.status === "scheduled");

  if (!capabilitiesLoading && !hasServerPermission("exams.view")) {
    return <PermissionDenied action="view exam publication" role={roleLabels[role]} backHref="/exams" />;
  }

  if (!exam) return null;

  const scopedClasses = classes.filter((c) => db.examClasses.some((ec) => ec.examId === exam.id && ec.classId === c.id));
  const scopedSections = scopedClasses.find((c) => c.id === classId)?.sections ?? [];

  function toggleChannel(key: ResultPublicationChannel) {
    setChannels((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Publish — {exam.name}</h1>
        <p className="text-xs text-muted-foreground">Review the checklist, then publish results to parents and students</p>
      </div>

      {activePublication && (
        <div className="flex flex-wrap items-center justify-between gap-sm rounded-lg border border-success/30 bg-success/8 p-md">
          <div className="flex items-center gap-sm">
            <UploadCloud className="size-5 text-success" />
            <div>
              <p className="text-sm font-semibold text-success">
                {activePublication.status === "published" ? "Results are published" : "Publication scheduled"}
              </p>
              <p className="text-xs text-muted-foreground">
                {activePublication.publishedAt ? `Published ${formatDateTime(activePublication.publishedAt)} by ${activePublication.publishedBy}` : `Scheduled for ${activePublication.publishAt}`}
              </p>
            </div>
          </div>
          {can("results.publish") && (
            <Button size="sm" variant="outline" className="text-error" onClick={() => setRevokeOpen(true)}>
              <XCircle className="size-3.5" />
              Revoke
            </Button>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Publication checklist</h2>
        <ul className="flex flex-col gap-1">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-center gap-sm text-sm">
              {item.done ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <AlertTriangle className="size-4 shrink-0 text-warning" />}
              <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {!activePublication && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <h2 className="text-sm font-semibold text-foreground">Publish options</h2>

          <div>
            <Label>Scope</Label>
            <div className="flex items-center gap-1 rounded-md bg-surface-secondary p-1">
              {(["all", "class", "section", "selected-students"] as ResultPublicationScope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`min-h-9 flex-1 rounded-md px-sm text-xs font-medium capitalize transition-colors ${scope === s ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}
                >
                  {s === "all" ? "All" : s.replace("-", " ")}
                </button>
              ))}
            </div>
          </div>

          {(scope === "class" || scope === "section") && (
            <div className="grid grid-cols-2 gap-sm">
              <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(""); }}>
                <SelectTrigger aria-label="Class">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {scopedClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {scope === "section" && (
                <Select value={sectionId} onValueChange={setSectionId} disabled={!classId}>
                  <SelectTrigger aria-label="Section">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {scopedSections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        Section {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div>
            <Label>Channels</Label>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {channelOptions.map(({ key, label, icon: Icon }) => (
                <label key={key} className="flex min-h-9 items-center gap-1.5 rounded-md border border-border px-sm text-sm text-foreground">
                  <Checkbox checked={channels.includes(key)} onCheckedChange={() => toggleChannel(key)} />
                  <Icon className="size-3.5 text-muted-foreground" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {canPublish && (
            <Button onClick={() => { setPublishError(null); setConfirmOpen(true); }} disabled={!allDone || (scope === "class" && !classId) || (scope === "section" && !sectionId)}>
              <Send className="size-3.5" />
              Publish results
            </Button>
          )}
          {!allDone && <p className="text-xs text-warning">Complete the checklist above before publishing.</p>}
          {publishError && (
            <p className="flex items-center gap-1.5 text-xs text-error">
              <AlertTriangle className="size-3.5 shrink-0" />
              {publishError}
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Publish results?"
        description="This makes results immediately visible to students and parents through the selected channels. This action is logged and can be revoked if needed."
        confirmLabel="Publish now"
        onConfirm={() => {
          try {
            publishResults(exam.id, scope, { classId: classId || undefined, sectionId: sectionId || undefined }, channels, ACTOR);
            setPublishError(null);
          } catch (err) {
            setPublishError(err instanceof Error ? err.message : "Unable to publish results.");
          }
          setConfirmOpen(false);
        }}
      />

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke publication?"
        description="Results will no longer be visible to students and parents until republished. A corrected result can be published as a new revision afterward."
        confirmLabel="Revoke"
        destructive
        onConfirm={() => {
          if (activePublication) revokePublication(activePublication.id, revokeReason.trim() || "Revoked by principal", ACTOR);
          setRevokeReason("");
          setRevokeOpen(false);
        }}
      />
    </div>
  );
}
