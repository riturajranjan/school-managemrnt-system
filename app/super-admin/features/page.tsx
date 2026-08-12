"use client";

// Real feature entitlements (Super Admin SA-4L). Reads GET /api/super-admin/
// features/[schoolId] — plan default + school override + effective state — and
// writes overrides via PATCH. No mock store: the school picker is the real
// Schools API, and every value is server-resolved (subscription → plan → PlanFeature,
// then override). Feature entitlement ("does the SCHOOL have this module?") is
// distinct from RBAC ("can the USER act?").
import { useState } from "react";
import { Blocks, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SchoolPicker } from "@/components/super-admin/school-picker";
import { usePermissions } from "@/components/providers/permissions-provider";
import { patchFeatureOverrideRequest, useSchoolFeatures } from "@/lib/hooks/api/use-platform-config";

export default function FeaturesPage() {
  const { hasServerPermission } = usePermissions();
  const canManage = hasServerPermission("platform.features.manage");
  const [schoolId, setSchoolId] = useState("");
  const { data, loading, error, reload } = useSchoolFeatures(schoolId);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function patch(featureKey: string, enabled: boolean | null) {
    setBusy(featureKey);
    setActionError(null);
    const res = await patchFeatureOverrideRequest(schoolId, { featureKey, enabled });
    setBusy(null);
    if (!res.success) setActionError(res.error.message);
    else reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Blocks className="size-5 text-primary" /> Feature entitlements</h1>
          <p className="text-xs text-muted-foreground">Per-school overrides on top of the plan default</p>
        </div>
        <SchoolPicker value={schoolId} onChange={setSchoolId} />
      </div>

      <p className="flex items-start gap-1 rounded-md border border-primary/25 bg-primary/5 p-sm text-xs text-primary">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Effective access = feature entitlement AND the user&apos;s RBAC permission. {data?.plan ? `Plan defaults from ${data.plan.name}.` : data && !data.hasSubscription ? "This school has no active subscription — every plan default is off." : ""}
      </p>

      {actionError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}
      {loading && <div className="py-2xl text-center text-sm text-muted-foreground">Loading features…</div>}
      {error && !loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load features: {error}</div>}

      {data && !loading && (
        <div className="flex flex-col gap-xs">
          {data.features.map((f) => {
            const overridden = f.override !== null;
            return (
              <div key={f.key} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{f.label}</p>
                    {overridden && <Badge tone="warning">Override</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Plan default: {f.planDefault ? "Included" : "Not included"}
                    {f.reason ? ` · ${f.reason}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={f.effective ? "success" : "neutral"}>{f.effective ? "Enabled" : "Disabled"}</Badge>
                  {canManage && (
                    <>
                      <Button size="sm" variant={f.effective ? "outline" : "primary"} disabled={busy === f.key} onClick={() => void patch(f.key, !f.effective)}>
                        {f.effective ? "Disable" : "Enable"}
                      </Button>
                      {overridden && (
                        <Button size="sm" variant="ghost" disabled={busy === f.key} onClick={() => void patch(f.key, null)}>
                          Reset
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
