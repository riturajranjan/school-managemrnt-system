"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, FileDigit, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { recordAccess, reportBrokenLink } from "@/lib/services/digital-resource-service";
import { roleLabels } from "@/lib/permissions/roles";
import { accessLevelLabels, digitalResourceTypeLabels } from "@/lib/types/library";

export default function DigitalLibraryPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Library", role: roleLabels[role] };
  const [query, setQuery] = useState("");
  const [, force] = useState(0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.digitalResources.filter((r) => (q ? r.title.toLowerCase().includes(q) || (r.subject ?? "").toLowerCase().includes(q) : true));
  }, [db.digitalResources, query]);

  if (!can("library.view") && !can("library.viewOwn")) return <PermissionDenied action="access digital resources" role={roleLabels[role]} />;
  const canManage = can("library.manageDigital");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Digital library</h1>
          <p className="text-xs text-muted-foreground">E-books, notes, question papers, audio and video</p>
        </div>
        {canManage && (
          <Button asChild size="sm">
            <a href="/library/settings">Manage resources</a>
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search digital resources…" className="pl-8" aria-label="Search digital resources" />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <FileDigit className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No digital resources match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md" style={{ background: `${r.thumbnailColor ?? "#18b0c8"}22`, color: r.thumbnailColor ?? "#18b0c8" }}>
                  <FileDigit className="size-4" />
                </span>
                <Badge tone="info">{digitalResourceTypeLabels[r.type]}</Badge>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.subject ?? "General"} · {accessLevelLabels[r.accessLevel]} · v{r.version}</p>
              </div>
              <div className="flex flex-wrap items-center gap-xs">
                <span className="text-xs text-muted-foreground">{r.viewCount} views</span>
                {r.brokenLinkReported && <Badge tone="error">Broken link reported</Badge>}
              </div>
              <div className="mt-auto flex flex-wrap gap-xs">
                <Button size="sm" variant="outline" onClick={() => { recordAccess(r.id, db.libraryMembers[0]?.id ?? "anon", "read"); force((n) => n + 1); }}>
                  {r.externalUrl ? <ExternalLink className="size-3.5" /> : <FileDigit className="size-3.5" />} Open
                </Button>
                {r.allowDownload && (
                  <Button size="sm" variant="ghost" onClick={() => { recordAccess(r.id, db.libraryMembers[0]?.id ?? "anon", "download"); force((n) => n + 1); }}>
                    <Download className="size-3.5" /> Download
                  </Button>
                )}
                {!r.brokenLinkReported && (
                  <Button size="sm" variant="ghost" onClick={() => { reportBrokenLink(r.id, actor); force((n) => n + 1); }}>
                    Report broken
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
