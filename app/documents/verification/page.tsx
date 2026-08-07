"use client";

import { useMemo, useState } from "react";
import { QrCode, ScanLine, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VerifyResult } from "@/components/documents/verify-result";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { verifyToken, type VerificationResult } from "@/lib/services/documents-service";
import { roleLabels } from "@/lib/permissions/roles";
import { documentTypeLabels, verificationStateLabels, verificationStateTone } from "@/lib/types/documents";
import { formatDateTime } from "@/lib/utils";

export default function VerificationPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);

  const recent = useMemo(() => [...db.verificationRecords].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt)).slice(0, 10), [db.verificationRecords]);
  const sampleTokens = useMemo(() => db.generatedDocuments.slice(0, 3).map((d) => d.verificationToken), [db.generatedDocuments]);

  if (!can("documents.verifyToken") && !can("documents.view")) return <PermissionDenied action="verify documents" role={roleLabels[role]} backHref="/documents" />;

  const run = (t: string) => { setInput(t); setResult(verifyToken(t)); };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><QrCode className="size-5 text-primary" /> Document verification</h1><p className="text-xs text-muted-foreground">Resolve an opaque token to a genuine/invalid result — no personal data is exposed.</p></div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="flex flex-col gap-sm">
          <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-surface-secondary/40 p-md text-center">
              <div className="flex flex-col items-center gap-1 text-muted-foreground"><ScanLine className="size-8" /><p className="text-xs">Scan a document QR or enter its token</p></div>
            </div>
            <div className="flex gap-xs">
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. NVX-XXXXXXXX" aria-label="Verification token" onKeyDown={(e) => { if (e.key === "Enter") run(input); }} />
              <Button size="sm" onClick={() => run(input)}><Search className="size-3.5" /> Verify</Button>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">Try:{sampleTokens.map((t) => <button key={t} type="button" onClick={() => run(t)} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-[11px] hover:text-foreground">{t}</button>)}<button type="button" onClick={() => run("NVX-ZZZZZZZZ")} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-[11px] hover:text-foreground">unknown</button></div>
          </div>

          {result && <VerifyResult state={result.state} record={result.record} />}
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Recent verification checks</h2>
          <div className="flex flex-col gap-xs">
            {recent.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <div className="min-w-0"><p className="truncate text-foreground">{v.documentNumber}</p><p className="truncate text-xs text-muted-foreground">{documentTypeLabels[v.documentType]} · {formatDateTime(v.checkedAt)}</p></div>
                <Badge tone={verificationStateTone[v.state]}>{verificationStateLabels[v.state]}</Badge>
              </div>
            ))}
            {recent.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No verification checks yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
