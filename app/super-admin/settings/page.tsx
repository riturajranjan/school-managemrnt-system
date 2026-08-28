"use client";

// Real platform settings (Super Admin SA-4N). Reads GET /api/super-admin/settings
// and saves via PATCH. Safe, non-secret configuration only (no SMTP/API/OAuth/
// payment secrets, no infrastructure credentials). No mock store: DB is the
// source of truth (a refresh reloads persisted values).
import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/components/providers/permissions-provider";
import { PlatformAdminsPanel } from "@/components/super-admin/platform-admins-panel";
import {
  updateSettingsRequest,
  usePlatformSettings,
} from "@/lib/hooks/api/use-platform-system";

type Draft = {
  platformName: string;
  supportEmail: string;
  defaultLocale: string;
  defaultTimezone: string;
  defaultCurrency: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  signupEnabled: boolean;
  defaultTrialDays: string;
};

export default function PlatformSettingsPage() {
  const { hasServerPermission } = usePermissions();
  const canManage = hasServerPermission("platform.settings.manage");
  const { data, loading, error, reload } = usePlatformSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync the editable draft from persisted settings on load/change (adjust state
  // during render, keyed on updatedAt — not an effect).
  if (data && loadedAt !== data.updatedAt) {
    setLoadedAt(data.updatedAt);
    setDraft({
      platformName: data.platformName,
      supportEmail: data.supportEmail ?? "",
      defaultLocale: data.defaultLocale,
      defaultTimezone: data.defaultTimezone,
      defaultCurrency: data.defaultCurrency,
      maintenanceMode: data.maintenanceMode,
      maintenanceMessage: data.maintenanceMessage ?? "",
      signupEnabled: data.signupEnabled,
      defaultTrialDays: String(data.defaultTrialDays),
    });
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  async function save() {
    if (!draft) return;
    setBusy(true);
    setActionError(null);
    const res = await updateSettingsRequest({
      platformName: draft.platformName.trim(),
      supportEmail: draft.supportEmail.trim() || null,
      defaultLocale: draft.defaultLocale.trim(),
      defaultTimezone: draft.defaultTimezone.trim(),
      defaultCurrency: draft.defaultCurrency.trim().toUpperCase(),
      maintenanceMode: draft.maintenanceMode,
      maintenanceMessage: draft.maintenanceMessage.trim() || null,
      signupEnabled: draft.signupEnabled,
      defaultTrialDays: Number(draft.defaultTrialDays) || 0,
    });
    setBusy(false);
    if (!res.success) setActionError(res.error.message);
    else reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <SettingsIcon className="size-5 text-primary" /> Platform team &amp;
          settings
        </h1>
        <p className="text-xs text-muted-foreground">
          Platform administrators and global, non-secret configuration
        </p>
      </div>

      <PlatformAdminsPanel />

      <h2 className="mt-sm text-sm font-semibold text-foreground">
        Platform settings
      </h2>
      {actionError && (
        <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">
          {actionError}
        </p>
      )}
      {loading && (
        <div className="py-2xl text-center text-sm text-muted-foreground">
          Loading settings…
        </div>
      )}
      {error && !loading && (
        <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">
          Could not load settings: {error}
        </div>
      )}

      {draft && !loading && (
        <div className="flex  flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <Field label="Platform name">
            <Input
              value={draft.platformName}
              disabled={!canManage}
              onChange={(e) => set("platformName", e.target.value)}
            />
          </Field>
          <Field label="Support email">
            <Input
              type="email"
              value={draft.supportEmail}
              disabled={!canManage}
              onChange={(e) => set("supportEmail", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
            <Field label="Default locale">
              <Input
                value={draft.defaultLocale}
                disabled={!canManage}
                onChange={(e) => set("defaultLocale", e.target.value)}
              />
            </Field>
            <Field label="Default timezone">
              <Input
                value={draft.defaultTimezone}
                disabled={!canManage}
                onChange={(e) => set("defaultTimezone", e.target.value)}
              />
            </Field>
            <Field label="Default currency">
              <Input
                value={draft.defaultCurrency}
                disabled={!canManage}
                onChange={(e) => set("defaultCurrency", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Default trial (days)">
            <Input
              type="number"
              value={draft.defaultTrialDays}
              disabled={!canManage}
              onChange={(e) => set("defaultTrialDays", e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.signupEnabled}
              disabled={!canManage}
              onChange={(e) => set("signupEnabled", e.target.checked)}
            />{" "}
            <span className="text-foreground">Signups enabled</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.maintenanceMode}
              disabled={!canManage}
              onChange={(e) => set("maintenanceMode", e.target.checked)}
            />{" "}
            <span className="text-foreground">Maintenance mode</span>
          </label>
          <Field label="Maintenance message">
            <Input
              value={draft.maintenanceMessage}
              disabled={!canManage}
              onChange={(e) => set("maintenanceMessage", e.target.value)}
            />
          </Field>
          {canManage && (
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={busy} onClick={() => void save()}>
                {busy ? "Saving…" : "Save settings"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={reload}>
                Reset
              </Button>
              {data && (
                <span className="text-xs text-muted-foreground">
                  Saved {new Date(data.updatedAt).toLocaleString("en-IN")}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
