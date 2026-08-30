"use client";

// Forced first-login password change — the real destination resolvePostLogin
// sends an authenticated user to whenever their account's password was set
// directly by an administrator with "force password change on next login"
// checked (User.passwordSetupRequired stays true even though a real password
// already exists). Always requires the current (administrator-set) password,
// exactly like any other self-service change — see
// lib/server/auth/password-change.ts. On success, re-resolves and continues
// to wherever normal login would have sent them.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput, PasswordStrengthMeter, passwordStrength } from "@/components/ui/password-input";
import { useChangeOwnPassword } from "@/lib/hooks/api/use-users-api";

export default function ForcedChangePasswordPage() {
  const router = useRouter();
  const change = useChangeOwnPassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const strength = passwordStrength(newPassword);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const error = localError ?? change.error;

  async function submit() {
    setLocalError(null);
    if (!currentPassword) return setLocalError("Enter your current password.");
    if (!strength.meetsPolicy) return setLocalError("Password must be at least 8 characters and include a letter and a number.");
    if (newPassword !== confirmPassword) return setLocalError("Passwords do not match.");

    const res = await change.run({ currentPassword, newPassword });
    if (res.success) router.push(res.data.redirectTo);
  }

  return (
    <AuthShell mobileTagline="Set a new password to continue">
      <AuthCard>
        <AuthHeader title="Set a new password" subtitle="Your administrator asked you to change your password before continuing." />
        <div className="mb-md flex items-start gap-2 rounded-md border border-border bg-muted/40 p-sm text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>Enter the password you were given, then choose a new one only you know.</span>
        </div>
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="fc-current">Current Password</Label>
            <PasswordInput id="fc-current" autoComplete="current-password" autoFocus value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fc-new">New Password</Label>
            <PasswordInput id="fc-new" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <PasswordStrengthMeter value={newPassword} />
          </div>
          <div>
            <Label htmlFor="fc-confirm">Confirm New Password</Label>
            <PasswordInput id="fc-confirm" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            {mismatch && <p className="mt-1 text-xs text-destructive">Passwords do not match.</p>}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button disabled={change.loading} onClick={submit} className="mt-1">
            {change.loading ? "Saving…" : "Set new password"}
          </Button>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
