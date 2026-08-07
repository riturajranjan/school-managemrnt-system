"use client";

import { useMemo, useState } from "react";
import { BookOpen, Search, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function KnowledgeBasePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.knowledgeArticles.filter((a) => (cat === "all" ? true : a.category === cat)).filter((a) => (q ? a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q) : true));
  }, [db.knowledgeArticles, query, cat]);

  if (!can("helpdesk.view") && !can("helpdesk.viewOwn")) return <PermissionDenied action="view the knowledge base" role={roleLabels[role]} backHref="/helpdesk" />;
  const categories = [...new Set(db.knowledgeArticles.map((a) => a.category))];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Knowledge base</h1>
        <p className="text-xs text-muted-foreground">Self-service help articles</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search help articles…" className="pl-8" aria-label="Search articles" />
      </div>
      <div className="flex gap-1 overflow-x-auto">
        <button onClick={() => setCat("all")} className={`shrink-0 rounded-pill px-3 py-1 text-xs font-medium capitalize ${cat === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>All</button>
        {categories.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-pill px-3 py-1 text-xs font-medium capitalize ${cat === c ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{c.replace("-", " ")}</button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <BookOpen className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No articles match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {rows.map((a) => (
            <div key={a.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm">
                <div className="flex items-center gap-sm">
                  <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><BookOpen className="size-4" /></span>
                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                </div>
                <Badge tone="neutral" className="capitalize">{a.category.replace("-", " ")}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{a.excerpt}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{a.views.toLocaleString("en-IN")} views · updated {formatDate(a.updatedAt)}</span>
                <span className="flex items-center gap-1 text-success"><ThumbsUp className="size-3" /> {a.helpfulPercent}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
