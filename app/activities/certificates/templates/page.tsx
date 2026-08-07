"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CertificatePreview } from "@/components/activities/certificate-preview";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { certificatePurposeLabels } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function CertificateTemplatesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [selected, setSelected] = useState(db.certificateTemplates[0]?.id ?? "");

  if (!can("activities.view")) return <PermissionDenied action="view certificate templates" role={roleLabels[role]} backHref="/activities/certificates" />;

  const template = db.certificateTemplates.find((t) => t.id === selected) ?? db.certificateTemplates[0];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/certificates"><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-lg font-semibold text-foreground">Certificate templates</h1><p className="text-xs text-muted-foreground">{db.certificateTemplates.length} templates</p></div>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,300px)_1fr]">
        <div className="flex flex-col gap-xs">
          {db.certificateTemplates.map((t) => (
            <button key={t.id} type="button" onClick={() => setSelected(t.id)} className={`flex items-center justify-between gap-sm rounded-lg border p-sm text-left text-sm transition ${selected === t.id ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-primary/40"}`}>
              <div className="flex items-center gap-2"><span className="size-4 rounded-full" style={{ backgroundColor: t.accentColor }} /><div><p className="font-medium text-foreground">{t.name}</p><p className="text-xs text-muted-foreground capitalize">{t.orientation} · {t.borderStyle}</p></div></div>
              <Badge tone="neutral">{certificatePurposeLabels[t.purpose]}</Badge>
            </button>
          ))}
        </div>
        {template && (
          <div className="flex items-start justify-center rounded-lg border border-border bg-surface-secondary/40 p-md">
            <CertificatePreview data={{ template, recipientName: "Aarav Sharma", eventTitle: "Annual Science Fair", position: "1st", issuedDate: formatDate(new Date().toISOString().slice(0, 10)) }} />
          </div>
        )}
      </div>
    </div>
  );
}
