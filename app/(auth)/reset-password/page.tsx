"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";
import { AuthLink, AuthLinkRow, AuthStatus } from "@/components/auth/misc";
import { scorePassword } from "@/lib/types/auth";

export default function ResetPasswordPage() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { score } = scorePassword(pw);
  const submit = () => {
    if (score < 3) { setError("Choose a stronger password."); return; }
    if (pw !== confirm) { setError("Passwords do not match."); return; }
    setError(null); setDone(true);
  };

  return (
    <AuthShell mobileTagline="Set a new password">
      <AuthCard>
        {done ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success"><CheckCircle2 className="size-6" /></span>
            <AuthHeader title="Password reset" />
            <p className="-mt-2 text-sm text-muted-foreground">Your password has been updated (simulation).</p>
            <Button asChild size="md"><a href="/login">Sign in</a></Button>
          </div>
        ) : (
          <>
            <AuthHeader title="Set a new password" subtitle="Choose a strong password you don't use elsewhere." />
            {error && <div className="mb-md"><AuthStatus tone="error">{error}</AuthStatus></div>}
            <div className="flex flex-col gap-md">
              <PasswordField label="New password" value={pw} onChange={(v) => { setPw(v); setError(null); }} autoComplete="new-password" />
              <PasswordStrengthMeter password={pw} />
              <PasswordField label="Confirm password" value={confirm} onChange={(v) => { setConfirm(v); setError(null); }} autoComplete="new-password" error={confirm && pw !== confirm ? "Passwords do not match" : undefined} />
              <Button size="md" onClick={submit}>Reset password</Button>
            </div>
            <AuthLinkRow><AuthLink href="/login">Back to sign-in</AuthLink></AuthLinkRow>
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
