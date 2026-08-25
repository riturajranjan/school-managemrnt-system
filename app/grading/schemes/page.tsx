"use client";

// Grading schemes (Phase 8C) — real PostgreSQL/API cutover. Same card-list +
// edit-bands-drawer shell as before. Dropped rather than fabricated: the
// grading "system" selector (letter/GPA/CGPA/skill/competency/…) — only
// percentage-band grading is real; "applicable classes" + "default scheme" —
// a scheme is School+Session scoped and an Exam explicitly picks ONE scheme
// (set on the exam itself, Phase 8A's Configuration section) rather than
// auto-resolving by class; "duplicate" — trivial to recreate manually, not
// worth a bespoke endpoint for a first cut.
import { useMemo, useState } from "react";
import { AlertTriangle, Archive, ArchiveRestore, Layers, Plus, Trash2 } from "lucide-react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createGradingSchemeRequest, saveGradingBandsRequest, updateGradingSchemeRequest, useGradingSchemes } from "@/lib/hooks/api/use-results-api";
import type { GradingSchemeDto } from "@/lib/api/contracts";

type BandDraft = { label: string; minPercent: number; maxPercent: number; isPass: boolean; color: string };

function blankBand(): BandDraft {
  return { label: "", minPercent: 0, maxPercent: 0, isPass: true, color: "#18b0c8" };
}

/** UX-only overlap/range check — the server is the real authority (fail-closed on save). */
function detectBandIssues(bands: BandDraft[]): string[] {
  const errors: string[] = [];
  const sorted = [...bands].sort((a, b) => a.minPercent - b.minPercent);
  for (const b of sorted) {
    if (b.minPercent > b.maxPercent) errors.push(`"${b.label || "Untitled"}": minimum is above maximum.`);
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (a.maxPercent >= b.minPercent) errors.push(`"${a.label || "Untitled"}" overlaps "${b.label || "Untitled"}".`);
  }
  return errors;
}

export default function GradingSchemesPage() {
  const { data: schemes, reload } = useGradingSchemes();
  const { can } = usePermissions();
  const canManage = can("exams.manageSchedule"); // client convenience key covering exam/grading configuration

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [editScheme, setEditScheme] = useState<GradingSchemeDto | null>(null);
  const [bands, setBands] = useState<BandDraft[]>([]);
  const [bandErrors, setBandErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const previewIssues = useMemo(() => detectBandIssues(bands), [bands]);

  if (!can("results.view")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to view grading schemes.</p>;
  }

  function openEdit(scheme: GradingSchemeDto) {
    setEditScheme(scheme);
    setBands(scheme.bands.map((b) => ({ label: b.label, minPercent: b.minPercent, maxPercent: b.maxPercent, isPass: b.isPass, color: b.color })));
    setBandErrors([]);
  }

  async function handleSaveBands() {
    if (!editScheme) return;
    setSaving(true);
    const res = await saveGradingBandsRequest(editScheme.id, bands);
    setSaving(false);
    if (!res.success) { setBandErrors([res.error.message]); return; }
    setBandErrors([]);
    setEditScheme(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Grading schemes</h1>
          <p className="text-xs text-muted-foreground">Grade bands used to convert marks into grades across exams</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { setName(""); setCreateOpen(true); }}>
            <Plus className="size-3.5" />
            New scheme
          </Button>
        )}
      </div>

      {schemes.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
            <Layers className="size-5" />
          </span>
          <div className="mx-auto flex flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">No grading schemes yet</p>
            <p className="text-sm text-muted-foreground">Create a scheme and define its grade bands, then assign it to an exam.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
          {schemes.map((s) => (
            <div key={s.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.bands.length} band{s.bands.length === 1 ? "" : "s"}</p>
                </div>
                <Badge tone={s.status === "active" ? "success" : "warning"}>{s.status}</Badge>
              </div>

              {s.bands.length === 0 ? (
                <div className="flex h-6 items-center justify-center rounded-md border border-dashed border-border text-[11px] text-muted-foreground">No grade bands defined</div>
              ) : (
                <div className="flex h-6 w-full overflow-hidden rounded-md border border-border shadow-card">
                  {[...s.bands].sort((a, b) => a.minPercent - b.minPercent).map((b) => (
                    <div key={b.id} title={`${b.label} · ${b.minPercent}%–${b.maxPercent}% ${b.isPass ? "(pass)" : "(fail)"}`}
                      className="flex min-w-[1.5rem] items-center justify-center border-r border-black/10 text-[10px] font-semibold text-white last:border-r-0"
                      style={{ width: `${Math.max(b.maxPercent - b.minPercent, 1)}%`, backgroundColor: b.color }}>
                      {b.label}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-sm text-xs">
                <div>
                  <p className="text-muted-foreground">Used by</p>
                  <p className="font-medium text-foreground">{s.examCount} exam{s.examCount === 1 ? "" : "s"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bands</p>
                  <p className="font-medium text-foreground">{s.bands.length}</p>
                </div>
              </div>

              {canManage && (
                <div className="flex flex-wrap items-center gap-xs border-t border-border pt-sm">
                  <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Edit bands</Button>
                  {s.status === "archived" ? (
                    <Button size="sm" variant="outline" onClick={async () => { await updateGradingSchemeRequest(s.id, { status: "active" }); reload(); }}>
                      <ArchiveRestore className="size-3.5" /> Restore
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-error" onClick={async () => { await updateGradingSchemeRequest(s.id, { status: "archived" }); reload(); }}>
                      <Archive className="size-3.5" /> Archive
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New grading scheme" description="Define grade bands after creating the scheme">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const res = await createGradingSchemeRequest({ name: name.trim() });
            setCreateOpen(false);
            if (res.success) { reload(); openEdit({ ...res.data }); }
          }}
          className="flex flex-col gap-sm"
        >
          <div>
            <Label htmlFor="scheme-name">Scheme name</Label>
            <Input id="scheme-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CBSE Pattern (Secondary)" />
          </div>
          <Button type="submit" disabled={!name.trim()}>Create &amp; add grade bands</Button>
        </form>
      </DetailDrawer>

      <DetailDrawer open={editScheme !== null} onOpenChange={(open) => !open && setEditScheme(null)} title={editScheme?.name ?? ""} description="Grade bands">
        {editScheme && (
          <div className="flex flex-col gap-md">
            {bandErrors.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">
                <p className="flex items-center gap-1 font-medium"><AlertTriangle className="size-3.5" /> Fix these before saving</p>
                {bandErrors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}

            <div className="flex flex-col gap-sm">
              {bands.map((band, index) => (
                <div key={index} className="flex flex-col gap-xs rounded-md border border-border p-sm">
                  <div className="flex items-center gap-xs">
                    <Input value={band.label} onChange={(e) => setBands((prev) => prev.map((b, i) => (i === index ? { ...b, label: e.target.value } : b)))} placeholder="Grade name" className="flex-1" aria-label={`Grade ${index + 1} name`} />
                    <Input type="color" value={band.color} onChange={(e) => setBands((prev) => prev.map((b, i) => (i === index ? { ...b, color: e.target.value } : b)))} className="h-11 w-12 shrink-0 p-1 sm:h-9" aria-label={`Grade ${index + 1} colour`} />
                    <Button type="button" size="icon" variant="ghost" onClick={() => setBands((prev) => prev.filter((_, i) => i !== index))} aria-label={`Remove grade ${index + 1}`}>
                      <Trash2 className="size-3.5 text-error" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-xs">
                    <div>
                      <Label htmlFor={`min-${index}`} className="text-[11px]">Min %</Label>
                      <Input id={`min-${index}`} type="number" value={band.minPercent} onChange={(e) => setBands((prev) => prev.map((b, i) => (i === index ? { ...b, minPercent: Number(e.target.value) } : b)))} />
                    </div>
                    <div>
                      <Label htmlFor={`max-${index}`} className="text-[11px]">Max %</Label>
                      <Input id={`max-${index}`} type="number" value={band.maxPercent} onChange={(e) => setBands((prev) => prev.map((b, i) => (i === index ? { ...b, maxPercent: Number(e.target.value) } : b)))} />
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox checked={band.isPass} onCheckedChange={(checked) => setBands((prev) => prev.map((b, i) => (i === index ? { ...b, isPass: checked === true } : b)))} />
                    Counts as a pass
                  </label>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setBands((prev) => [...prev, blankBand()])} className="self-start">
                <Plus className="size-3.5" /> Add grade band
              </Button>
            </div>

            {previewIssues.length > 0 && (
              <div className="flex flex-col gap-0.5 text-xs text-warning">
                {previewIssues.map((issue, i) => (
                  <span key={i} className="flex items-start gap-1"><AlertTriangle className="mt-0.5 size-3 shrink-0" /> {issue}</span>
                ))}
              </div>
            )}

            <Button onClick={handleSaveBands} disabled={saving}>Save grade bands</Button>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
