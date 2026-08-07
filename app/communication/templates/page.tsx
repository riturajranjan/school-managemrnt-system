"use client";

import { useState } from "react";
import { FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChannelChips } from "@/components/communication/channel-chips";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { templateCategoryLabels, type TemplateCategory } from "@/lib/types/communication";

export default function TemplatesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [lang, setLang] = useState<Record<string, "en" | "hi">>({});

  if (!can("comm.view")) return <PermissionDenied action="view templates" role={roleLabels[role]} backHref="/communication" />;

  const q = query.trim().toLowerCase();
  const templates = db.commTemplates.filter((t) => (cat === "all" ? true : t.category === cat)).filter((t) => (q ? t.name.toLowerCase().includes(q) : true));
  const categoriesInUse = [...new Set(db.commTemplates.map((t) => t.category))];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Communication templates</h1>
        <p className="text-xs text-muted-foreground">{db.commTemplates.length} reusable message templates · English & Hindi</p>
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates…" className="pl-8" aria-label="Search templates" />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <button onClick={() => setCat("all")} className={`shrink-0 rounded-pill px-3 py-1 text-xs font-medium ${cat === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>All</button>
          {categoriesInUse.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-pill px-3 py-1 text-xs font-medium ${cat === c ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{templateCategoryLabels[c as TemplateCategory]}</button>
          ))}
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <FileText className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No templates match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
          {templates.map((t) => {
            const l = lang[t.id] ?? "en";
            return (
              <div key={t.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
                <div className="flex items-start justify-between gap-sm">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.subject}</p>
                  </div>
                  <Badge tone="neutral">{templateCategoryLabels[t.category]}</Badge>
                </div>
                <div className="inline-flex w-fit rounded-md border border-border p-0.5">
                  <button onClick={() => setLang((prev) => ({ ...prev, [t.id]: "en" }))} className={`rounded px-2 py-0.5 text-xs font-medium ${l === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>EN</button>
                  <button onClick={() => setLang((prev) => ({ ...prev, [t.id]: "hi" }))} className={`rounded px-2 py-0.5 text-xs font-medium ${l === "hi" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>हिं</button>
                </div>
                <p className="rounded-md bg-surface-secondary/50 p-sm text-sm text-foreground">{l === "en" ? t.bodyEn : t.bodyHi}</p>
                <div className="flex flex-wrap gap-1">
                  {t.variables.map((v) => <span key={v} className="rounded-pill bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">{`{{${v}}}`}</span>)}
                </div>
                <ChannelChips channels={t.channels} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
