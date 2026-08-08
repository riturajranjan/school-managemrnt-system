"use client";

import { useMemo, useState } from "react";
import { Eye, FileText, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { UnsavedBar } from "@/components/settings/unsaved-bar";
import { useLegalDocuments } from "@/lib/hooks/use-admin";
import type { LegalDocument } from "@/lib/types/admin";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Structured editor + preview for legal documents of the given kinds.
 * Frontend-only — edits are local (not persisted). */
export function LegalEditor({ kinds, title }: { kinds: LegalDocument["kind"][]; title: string }) {
  const docs = useLegalDocuments();
  const relevant = useMemo(() => docs.filter((d) => kinds.includes(d.kind)), [docs, kinds]);
  const [activeId, setActiveId] = useState(relevant[0]?.id ?? "");
  const active = relevant.find((d) => d.id === activeId) ?? relevant[0];
  const [body, setBody] = useState(active?.body ?? "");
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [saved, setSaved] = useState(false);

  if (!active) return <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No {title.toLowerCase()} documents.</div>;
  const dirty = body !== active.body;

  const select = (id: string) => { const d = relevant.find((x) => x.id === id); setActiveId(id); setBody(d?.body ?? ""); setSaved(false); };

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><FileText className="size-5 text-primary" /> {title}</h1><p className="text-xs text-muted-foreground">Structured editor & preview · frontend only</p></div>

      {relevant.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {relevant.map((d) => <button key={d.id} type="button" onClick={() => select(d.id)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", activeId === d.id ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>{d.title}</button>)}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground">{active.title}</span><Badge tone="neutral">{active.version}</Badge><Badge tone={active.status === "published" ? "success" : "warning"}>{active.status}</Badge><span className="text-xs text-muted-foreground">Updated {formatDate(active.updatedAt)}</span></div>
        <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5">
          <button type="button" onClick={() => setMode("preview")} className={cn("flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium", mode === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}><Eye className="size-3.5" /> Preview</button>
          <button type="button" onClick={() => setMode("edit")} className={cn("flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium", mode === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}><Pencil className="size-3.5" /> Edit</button>
        </div>
      </div>

      {mode === "edit" ? (
        <Textarea value={body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setBody(e.target.value); setSaved(false); }} rows={12} className="font-mono text-sm" />
      ) : (
        <div className="rounded-lg border border-border bg-surface p-md">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{body}</p>
        </div>
      )}

      <UnsavedBar dirty={dirty} saved={saved} onSave={() => setSaved(true)} onDiscard={() => { setBody(active.body); setSaved(false); }} />
    </div>
  );
}
