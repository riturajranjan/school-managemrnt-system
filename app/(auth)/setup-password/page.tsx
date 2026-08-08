"use client";

import { useActionState, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";
import { AuthLink, AuthLinkRow, AuthStatus } from "@/components/auth/misc";
import { setupPasswordAction, type SetupState } from "@/lib/server/actions/setup";

// Real password setup for invited/first-time accounts. Submits to
// setupPasswordAction which sets the credential via Better Auth, clears the
// passwordSetupRequired flag, then routes onward via the resolver.
export default function SetupPasswordPage() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, formAction, pending] = useActionState<SetupState, FormData>(setupPasswordAction, undefined);

  return (
    <AuthShell mobileTagline="Set your password">
      <AuthCard>
        <div className="mb-md flex flex-col items-center text-center"><span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Lock className="size-5" /></span></div>
        <AuthHeader title="Create your password" subtitle="Set a password to secure your new account." />
        {state?.error && <div className="mb-md"><AuthStatus tone="error">{state.error}</AuthStatus></div>}
        <form action={formAction} className="flex flex-col gap-md">
          <PasswordField label="Password" value={pw} onChange={setPw} name="password" autoComplete="new-password" />
          <PasswordStrengthMeter password={pw} />
          <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} name="confirm" autoComplete="new-password" error={confirm && pw !== confirm ? "Passwords do not match" : undefined} />
          <Button size="md" type="submit" disabled={pending || pw.length < 8 || pw !== confirm}>{pending ? "Setting password…" : "Set password"}</Button>
        </form>
        <AuthLinkRow><AuthLink href="/login">Back to sign-in</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthShell>
  );
}
