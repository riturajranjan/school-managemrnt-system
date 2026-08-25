"use client";

// Library settings (Phase 9N) — real, admin-editable LibraryPolicy. Never a
// silently hardcoded loan-duration/fine rule — this page is that policy's
// single source of truth.
import { useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  updateLibraryPolicyRequest,
  useLibraryPolicy,
} from "@/lib/hooks/api/use-library-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { LibraryPolicyDto } from "@/lib/api/contracts";

export default function LibrarySettingsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: policy, loading, reload } = useLibraryPolicy();

  if (!capabilitiesLoading && !hasServerPermission("library.manage")) {
    return (
      <PermissionDenied
        action="edit library settings"
        role={roleLabels[role]}
        backHref="/library"
      />
    );
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Library settings
        </h1>
        <p className="text-xs text-muted-foreground">
          Loan duration and fine policy — applied to every new issue and renewal
        </p>
      </div>

      {loading || !policy ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
          Loading…
        </p>
      ) : (
        <PolicyForm policy={policy} onSaved={reload} />
      )}
    </div>
  );
}

function PolicyForm({
  policy,
  onSaved,
}: {
  policy: LibraryPolicyDto;
  onSaved: () => void;
}) {
  const [loanDurationDays, setLoanDurationDays] = useState(
    String(policy.loanDurationDays),
  );
  const [finePerDay, setFinePerDay] = useState(String(policy.finePerDay));
  const [graceDays, setGraceDays] = useState(String(policy.graceDays));
  const [maxFineAmount, setMaxFineAmount] = useState(
    policy.maxFineAmount === null ? "" : String(policy.maxFineAmount),
  );
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <ShieldCheck className="size-4" /> Loan policy
      </h2>
      {saveError && <p className="text-xs text-error">{saveError}</p>}
      {saved && <p className="text-xs text-success">Saved.</p>}
      <div>
        <Label htmlFor="loan-duration">Loan duration (days)</Label>
        <Input
          id="loan-duration"
          type="number"
          min={1}
          value={loanDurationDays}
          onChange={(e) => setLoanDurationDays(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="fine-per-day">Fine per day (₹)</Label>
        <Input
          id="fine-per-day"
          type="number"
          min={0}
          step="0.01"
          value={finePerDay}
          onChange={(e) => setFinePerDay(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="grace-days">Grace days</Label>
        <Input
          id="grace-days"
          type="number"
          min={0}
          value={graceDays}
          onChange={(e) => setGraceDays(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="max-fine">Maximum fine (₹, optional)</Label>
        <Input
          id="max-fine"
          type="number"
          min={0}
          step="0.01"
          value={maxFineAmount}
          onChange={(e) => setMaxFineAmount(e.target.value)}
          placeholder="No cap"
        />
      </div>
      <Button
        onClick={async () => {
          setSaveError(null);
          setSaved(false);
          const res = await updateLibraryPolicyRequest({
            loanDurationDays: Number(loanDurationDays),
            finePerDay: Number(finePerDay),
            graceDays: Number(graceDays),
            maxFineAmount:
              maxFineAmount.trim() === "" ? null : Number(maxFineAmount),
          });
          if (!res.success) {
            setSaveError(res.error.message);
            return;
          }
          setSaved(true);
          onSaved();
        }}>
        <Save className="size-3.5" />
        Save policy
      </Button>
    </div>
  );
}
