"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Copy, Download, KeyRound, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOCK_RECOVERY_CODES } from "@/lib/types/auth";

export default function RecoveryCodesPage() {
  const [codes, setCodes] = useState(MOCK_RECOVERY_CODES);
  const [copied, setCopied] = useState(false);

  const regenerate = () => setCodes((prev) => prev.map(() => `${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`));

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/security"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><KeyRound className="size-5 text-primary" /> Recovery codes</h1><p className="text-xs text-muted-foreground">Use these if you lose access to your second factor</p></div></div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
          {codes.map((c) => <span key={c} className="rounded-md border border-border bg-surface-secondary/40 px-3 py-1.5 text-center text-foreground">{c}</span>)}
        </div>
        <div className="mt-md flex flex-wrap gap-xs">
          <Button size="sm" variant="outline" onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy className="size-3.5" /> {copied ? "Copied (simulation)" : "Copy all"}</Button>
          <Button size="sm" variant="outline" disabled title="Download (simulation)"><Download className="size-3.5" /> Download</Button>
          <Button size="sm" variant="ghost" onClick={regenerate}><RotateCcw className="size-3.5" /> Regenerate</Button>
        </div>
      </div>
      <p className="rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">Demo mode — these are obviously mock codes and grant no real access. Store real recovery codes securely.</p>
    </div>
  );
}
