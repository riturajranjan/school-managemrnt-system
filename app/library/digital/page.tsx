"use client";

// Real PostgreSQL/API cutover (Production migration, Phase A) — reads/writes
// GET/POST /api/library/digital-resources. Every resource is a real,
// admin-entered external link — this system has no file/object storage
// integration, so there is no upload flow to fake. View-count/broken-link-
// report affordances from the pre-migration mock had no real backing and
// are dropped rather than faked.
import { useState } from "react";
import { ExternalLink, FileDigit, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createDigitalResourceRequest, deleteDigitalResourceRequest, useLibraryDigitalResources } from "@/lib/hooks/api/use-library-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { LibraryDigitalAccessLevelDto, LibraryDigitalResourceTypeDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const typeLabels: Record<LibraryDigitalResourceTypeDto, string> = {
  ebook: "E-book", notes: "Notes", question_paper: "Question paper", audio: "Audio", video: "Video", other: "Other",
};
const accessLabels: Record<LibraryDigitalAccessLevelDto, string> = { all: "Everyone", students: "Students", staff: "Staff" };

export default function DigitalLibraryPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [query, setQuery] = useState("");
  const { data: resources, loading, error, reload } = useLibraryDigitalResources({ search: query.trim() || undefined });

  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState<LibraryDigitalResourceTypeDto>("notes");
  const [url, setUrl] = useState("");
  const [accessLevel, setAccessLevel] = useState<LibraryDigitalAccessLevelDto>("all");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("library.view")) return <PermissionDenied action="access digital resources" role={roleLabels[role]} backHref="/library" />;
  const canManage = hasServerPermission("library.manage");

  async function addResource() {
    setFormError(null);
    if (!title.trim() || !url.trim()) return setFormError("Title and link are required.");
    setSaving(true);
    const res = await createDigitalResourceRequest({ title: title.trim(), subject: subject.trim() || undefined, type, url: url.trim(), accessLevel });
    setSaving(false);
    if (!res.success) return setFormError(res.error.message);
    setAddOpen(false);
    setTitle(""); setSubject(""); setUrl(""); setType("notes"); setAccessLevel("all");
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Digital library</h1>
          <p className="text-xs text-muted-foreground">Links to e-books, notes, question papers, audio and video the school already hosts</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" /> Add resource
          </Button>
        )}
      </div>

      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search digital resources…" aria-label="Search digital resources" />

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && resources.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!loading && resources.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <FileDigit className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{query.trim() ? "No digital resources match your search." : "No digital resources yet."}</p>
          {canManage && !query.trim() && (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>Add your first resource</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => (
            <div key={r.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileDigit className="size-4" />
                </span>
                <Badge tone="info">{typeLabels[r.type]}</Badge>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.subject ?? "General"} · {accessLabels[r.accessLevel]} · added {formatDate(r.createdAt)}</p>
              </div>
              <div className="mt-auto flex flex-wrap gap-xs">
                <Button size="sm" variant="outline" asChild>
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" /> Open
                  </a>
                </Button>
                {canManage && (
                  <Button size="sm" variant="ghost" className="text-error" onClick={() => deleteDigitalResourceRequest(r.id).then(reload)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <DetailDrawer open={addOpen} onOpenChange={setAddOpen} title="Add digital resource" description="Link to content the school already hosts elsewhere">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="dr-title">Title</Label>
            <Input id="dr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Class 10 Physics Notes" />
          </div>
          <div>
            <Label htmlFor="dr-subject">Subject (optional)</Label>
            <Input id="dr-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="dr-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as LibraryDigitalResourceTypeDto)}>
              <SelectTrigger id="dr-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(typeLabels) as LibraryDigitalResourceTypeDto[]).map((t) => <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="dr-url">Link</Label>
            <Input id="dr-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label htmlFor="dr-access">Who can see this</Label>
            <Select value={accessLevel} onValueChange={(v) => setAccessLevel(v as LibraryDigitalAccessLevelDto)}>
              <SelectTrigger id="dr-access"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(accessLabels) as LibraryDigitalAccessLevelDto[]).map((a) => <SelectItem key={a} value={a}>{accessLabels[a]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {formError && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{formError}</p>}
          <Button disabled={saving} onClick={addResource}>Add resource</Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
