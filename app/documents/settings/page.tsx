"use client";

import { useState } from "react";
import { FileSignature, Hash, Info, Stamp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatNumber } from "@/lib/services/documents-service";
import { roleLabels } from "@/lib/permissions/roles";
import { documentTypeLabels } from "@/lib/types/documents";
import { DOC_BRANDING } from "@/lib/data/seed/documents";

export default function DocumentSettingsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [tab, setTab] = useState<"numbering" | "signatories" | "branding">("numbering");

  if (!can("documents.view")) return <PermissionDenied action="view document settings" role={roleLabels[role]} backHref="/documents" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Document settings</h1><p className="text-xs text-muted-foreground">Numbering formats, signatories and branding · frontend preview only</p></div>

      <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5 w-fit">
        {([["numbering", Hash, "Numbering"], ["signatories", FileSignature, "Signatories"], ["branding", Stamp, "Branding"]] as const).map(([k, Icon, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><Icon className="size-3.5" /> {label}</button>
        ))}
      </div>

      {tab === "numbering" && <NumberingTab db={db} />}
      {tab === "signatories" && <SignatoriesTab db={db} />}
      {tab === "branding" && <BrandingTab />}
    </div>
  );
}

function NumberingTab({ db }: { db: ReturnType<typeof useSisStore> }) {
  return (
    <div className="flex flex-col gap-sm">
      <p className="flex items-start gap-1 rounded-md border border-primary/25 bg-primary/5 p-sm text-xs text-primary"><Info className="mt-0.5 size-3.5 shrink-0" /> Numbering is a frontend preview. Changing a format here would affect newly generated document numbers only.</p>
      {db.documentNumberingRules.map((r) => (
        <div key={r.id} className="rounded-lg border border-border bg-surface p-md">
          <div className="flex items-center justify-between gap-sm"><p className="text-sm font-semibold text-foreground">{r.name}</p><Badge tone="info">Next: {formatNumber(r.prefix, r.includeYear, r.branchCode, r.separator, r.sequenceLength, r.nextSequence)}</Badge></div>
          <div className="mt-sm grid grid-cols-2 gap-x-md gap-y-1 text-sm sm:grid-cols-4">
            <Field label="Prefix" value={r.prefix} />
            <Field label="Year" value={r.includeYear ? "Yes" : "No"} />
            <Field label="Branch code" value={r.branchCode ?? "—"} />
            <Field label="Separator" value={`" ${r.separator} "`} />
            <Field label="Sequence length" value={String(r.sequenceLength)} />
            <Field label="Next sequence" value={String(r.nextSequence)} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Applies to: {r.docTypes.map((t) => documentTypeLabels[t]).join(", ")}</p>
        </div>
      ))}
    </div>
  );
}

function SignatoriesTab({ db }: { db: ReturnType<typeof useSisStore> }) {
  return (
    <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
      {db.signatoryProfiles.map((s) => (
        <div key={s.id} className="rounded-lg border border-border bg-surface p-md">
          <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-foreground">{s.name}</p><p className="text-xs text-muted-foreground">{s.designation}</p></div><div className="flex gap-1">{s.hasSignature && <Badge tone="success">Signature</Badge>}{s.hasSeal && <Badge tone="info">Seal</Badge>}</div></div>
          <p className="mt-sm text-xs text-muted-foreground">Applies to: {s.applicableTypes.slice(0, 4).map((t) => documentTypeLabels[t]).join(", ")}{s.applicableTypes.length > 4 ? ` +${s.applicableTypes.length - 4}` : ""}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Signature & seal are placeholders — no real digital signature is applied.</p>
        </div>
      ))}
    </div>
  );
}

function BrandingTab() {
  return (
    <div className="rounded-lg border border-border bg-surface p-md text-sm">
      <p className="mb-sm flex items-start gap-1 rounded-md border border-primary/25 bg-primary/5 p-sm text-xs text-primary"><Info className="mt-0.5 size-3.5 shrink-0" /> Branding is reused from the school profile — Document Studio does not maintain a separate branding store.</p>
      <dl className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-2">
        <Field label="School name" value={DOC_BRANDING.name} />
        <Field label="Website" value={DOC_BRANDING.website} />
        <Field label="Address" value={DOC_BRANDING.address} />
        <Field label="Contact" value={DOC_BRANDING.contact} />
        <Field label="Academic session" value={DOC_BRANDING.session} />
        <Field label="Registration" value={DOC_BRANDING.registration} />
      </dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm text-foreground">{value}</dd></div>;
}
