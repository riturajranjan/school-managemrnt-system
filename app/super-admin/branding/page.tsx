"use client";

// Real school branding (Super Admin SA-4L). Reads GET /api/super-admin/branding/
// [schoolId] and saves via PATCH. Storage boundary: URL/metadata only — no file
// uploads, no client-storage persistence. The preview updates client-side while
// editing, but persisted truth is the DB (a refresh reloads saved values). No
// mock store.
import { useState } from "react";
import { Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SchoolPicker } from "@/components/super-admin/school-picker";
import { usePermissions } from "@/components/providers/permissions-provider";
import { updateBrandingRequest, useBranding } from "@/lib/hooks/api/use-platform-config";

type Draft = {
  displayName: string; logoUrl: string; faviconUrl: string;
  primaryColor: string; accentColor: string;
  loginHeadline: string; loginSubheadline: string; footerText: string;
};

const EMPTY: Draft = { displayName: "", logoUrl: "", faviconUrl: "", primaryColor: "", accentColor: "", loginHeadline: "", loginSubheadline: "", footerText: "" };

export default function BrandingPage() {
  const { hasServerPermission } = usePermissions();
  const canManage = hasServerPermission("platform.branding.manage");
  const [schoolId, setSchoolId] = useState("");
  const { data, loading, error, reload } = useBranding(schoolId);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reset the editable draft from the persisted (DB) branding whenever a
  // different school loads or the saved values change — React's recommended
  // "adjust state during render" pattern (keyed on a signature), not an effect,
  // so the DB stays the source of truth (a refresh reloads saved values).
  const signature = data ? `${data.school.id}:${data.updatedAt ?? ""}` : null;
  const [loadedSig, setLoadedSig] = useState<string | null>(null);
  if (data && signature !== loadedSig) {
    setLoadedSig(signature);
    setDraft({
      displayName: data.displayName ?? "", logoUrl: data.logoUrl ?? "", faviconUrl: data.faviconUrl ?? "",
      primaryColor: data.primaryColor ?? "", accentColor: data.accentColor ?? "",
      loginHeadline: data.loginHeadline ?? "", loginSubheadline: data.loginSubheadline ?? "", footerText: data.footerText ?? "",
    });
  }

  const set = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const toNull = (v: string) => (v.trim() === "" ? null : v.trim());

  async function save() {
    setBusy(true);
    setActionError(null);
    const res = await updateBrandingRequest(schoolId, {
      displayName: toNull(draft.displayName), logoUrl: toNull(draft.logoUrl), faviconUrl: toNull(draft.faviconUrl),
      primaryColor: toNull(draft.primaryColor), accentColor: toNull(draft.accentColor),
      loginHeadline: toNull(draft.loginHeadline), loginSubheadline: toNull(draft.loginSubheadline), footerText: toNull(draft.footerText),
    });
    setBusy(false);
    if (!res.success) setActionError(res.error.message);
    else reload();
  }

  const accent = draft.accentColor || "#18b0c8";
  const name = draft.displayName || data?.school.name || "School";

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Palette className="size-5 text-primary" /> School branding</h1>
          <p className="text-xs text-muted-foreground">Per-school branding · URL/metadata only (no uploads)</p>
        </div>
        <SchoolPicker value={schoolId} onChange={setSchoolId} />
      </div>

      {actionError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}
      {loading && <div className="py-2xl text-center text-sm text-muted-foreground">Loading branding…</div>}
      {error && !loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load branding: {error}</div>}

      {data && !loading && (
        <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            {([
              ["displayName", "Display name", "text"], ["logoUrl", "Logo URL", "url"], ["faviconUrl", "Favicon URL", "url"],
              ["primaryColor", "Primary colour (#RRGGBB)", "text"], ["accentColor", "Accent colour (#RRGGBB)", "text"],
              ["loginHeadline", "Login headline", "text"], ["loginSubheadline", "Login subheadline", "text"], ["footerText", "Footer text", "text"],
            ] as const).map(([key, label, type]) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <Input type={type} value={draft[key]} disabled={!canManage} onChange={(e) => set(key)(e.target.value)} aria-label={label} />
              </label>
            ))}
            {canManage && (
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save branding"}</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={reload}>Reset</Button>
                {data.updatedAt && <span className="text-xs text-muted-foreground">Saved {new Date(data.updatedAt).toLocaleString("en-IN")}</span>}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface-secondary/40 p-md">
            <p className="mb-sm text-xs font-semibold text-foreground">Login preview</p>
            <div className="overflow-hidden rounded-lg border border-border bg-white text-neutral-900" style={{ borderTopColor: accent, borderTopWidth: 4 }}>
              <div className="p-4 text-center">
                <span className="mx-auto mb-2 flex size-9 items-center justify-center rounded text-white" style={{ background: accent }}>{name.slice(0, 1)}</span>
                <p className="text-sm font-bold">{name}</p>
                {draft.loginHeadline && <p className="text-[11px] font-medium text-neutral-700">{draft.loginHeadline}</p>}
                {draft.loginSubheadline && <p className="text-[9px] text-neutral-400">{draft.loginSubheadline}</p>}
                <div className="mt-2 space-y-1"><div className="h-6 rounded border border-neutral-200" /><div className="h-6 rounded text-white" style={{ background: accent }} /></div>
              </div>
            </div>
            <Badge tone="neutral" className="mt-sm">Preview reflects unsaved edits</Badge>
          </div>
        </div>
      )}
    </div>
  );
}
