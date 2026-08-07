"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileBadge, LayoutTemplate, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CertificatePreview } from "@/components/activities/certificate-preview";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { issueCertificate } from "@/lib/services/activities-service";
import { roleLabels } from "@/lib/permissions/roles";
import type { ResultPosition } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

const statusTone = { draft: "warning", issued: "success", revoked: "error" } as const;

export default function CertificatesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  const [templateId, setTemplateId] = useState(db.certificateTemplates[0]?.id ?? "");
  const [recipientName, setRecipientName] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [position, setPosition] = useState<ResultPosition>("participation");
  const [ok, setOk] = useState(false);

  const template = db.certificateTemplates.find((t) => t.id === templateId);
  const certificates = useMemo(() => [...db.certificates].sort((a, b) => b.issuedDate.localeCompare(a.issuedDate)), [db.certificates]);

  if (!can("activities.view")) return <PermissionDenied action="view certificates" role={roleLabels[role]} backHref="/activities" />;

  const canManage = can("activities.manageCertificates");
  const issue = () => {
    if (!template) return;
    const r = issueCertificate({ templateId, recipientName, eventTitle, position, issuedBy: roleLabels[role] });
    if (r.ok) { setOk(true); setRecipientName(""); force((n) => n + 1); }
  };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><FileBadge className="size-5 text-primary" /> Certificates</h1><p className="text-xs text-muted-foreground">{db.certificates.length} certificates · print-styled</p></div>
        <div className="flex gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/activities/certificates/templates"><LayoutTemplate className="size-3.5" /> Templates</Link></Button>
          {canManage && <Button asChild size="sm" variant="outline"><Link href="/activities/certificates/ceremony"><Sparkles className="size-3.5" /> Ceremony</Link></Button>}
        </div>
      </div>

      {canManage && template && (
        <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,360px)_1fr]">
          <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <h2 className="text-sm font-semibold text-foreground">Certificate builder</h2>
            <div><Label>Template</Label><Select value={templateId} onValueChange={setTemplateId}><SelectTrigger aria-label="Template"><SelectValue /></SelectTrigger><SelectContent>{db.certificateTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="rname">Recipient name</Label><Input id="rname" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="e.g. Aarav Sharma" /></div>
            <div><Label htmlFor="etitle">Event / occasion</Label><Input id="etitle" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="e.g. Annual Science Fair" /></div>
            <div><Label>Position</Label><Select value={position} onValueChange={(v) => setPosition(v as ResultPosition)}><SelectTrigger aria-label="Position"><SelectValue /></SelectTrigger><SelectContent>{(["1st", "2nd", "3rd", "participation", "special"] as ResultPosition[]).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            {ok && <p className="rounded-md border border-success/30 bg-success/8 p-sm text-xs text-success">Certificate issued.</p>}
            <Button size="sm" onClick={issue} disabled={!recipientName.trim() || !eventTitle.trim()}>Issue certificate</Button>
          </div>
          <div className="flex items-start justify-center rounded-lg border border-border bg-surface-secondary/40 p-md">
            <CertificatePreview data={{ template, recipientName, eventTitle, position, issuedDate: formatDate(new Date().toISOString().slice(0, 10)) }} />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Issued certificates</h2>
        <div className="flex flex-col gap-xs">
          {certificates.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
              <div className="min-w-0"><p className="truncate font-medium text-foreground">{c.recipientName}</p><p className="truncate text-xs text-muted-foreground">{c.eventTitle} · {c.serial} · {formatDate(c.issuedDate)}</p></div>
              <Badge tone={statusTone[c.status]}>{c.status}</Badge>
            </div>
          ))}
          {certificates.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No certificates issued yet.</p>}
        </div>
      </div>
    </div>
  );
}
