"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";
import { AuthLink, AuthLinkRow, AuthStatus } from "@/components/auth/misc";
import { resetPasswordAction, type PasswordState } from "@/lib/server/actions/password";

// Real reset-password. The one-time token arrives in the URL (?token=…) from the
// emailed link; resetPasswordAction verifies it via Better Auth (expiry +
// single-use enforced there) and, on success, redirects to /login.
function ResetPasswordInner() {
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(resetPasswordAction, undefined);

  return (
    <AuthShell mobileTagline="Set a new password">
      <AuthCard>
        <AuthHeader title="Set a new password" subtitle="Choose a strong password you don't use elsewhere." />
        {!token && <div className="mb-md"><AuthStatus tone="error">This reset link is invalid or has expired. Request a new one.</AuthStatus></div>}
        {state?.error && <div className="mb-md"><AuthStatus tone="error">{state.error}</AuthStatus></div>}
        <form action={formAction} className="flex flex-col gap-md">
          <input type="hidden" name="token" value={token} />
          <PasswordField label="New password" value={pw} onChange={setPw} name="password" autoComplete="new-password" />
          <PasswordStrengthMeter password={pw} />
          <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} name="confirm" autoComplete="new-password" error={confirm && pw !== confirm ? "Passwords do not match" : undefined} />
          <Button size="md" type="submit" disabled={pending || !token || pw.length < 8 || pw !== confirm}>{pending ? "Resetting…" : "Reset password"}</Button>
        </form>
        <AuthLinkRow><AuthLink href="/login">Back to sign-in</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams requires a Suspense boundary during static generation.
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  );
}
