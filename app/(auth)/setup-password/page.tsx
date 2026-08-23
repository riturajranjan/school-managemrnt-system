"use client";

// Phase 9W.2 — real cutover. Was a pure UI mock (setDone(true) with no server
// call). Now calls POST /api/auth/setup-password with the token from the
// setup link (issued once by the provisioning flow — no email is sent, an
// authorized actor shares this link manually). On success, routes to /login —
// not the mock /first-login wizard — since completing setup only ever sets a
// real password on the real User row; nothing else about the account changes.
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";
import { AuthLink, AuthLinkRow, AuthStatus } from "@/components/auth/misc";
import { scorePassword } from "@/lib/types/auth";
import { apiPost } from "@/lib/api/client";

function SetupPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!token) { setError("This setup link is missing its token."); return; }
    if (scorePassword(pw).score < 3) { setError("Choose a stronger password."); return; }
    if (pw !== confirm) { setError("Passwords do not match."); return; }
    setError(null);
    setSubmitting(true);
    const res = await apiPost<{ email: string }>("/api/auth/setup-password", { token, password: pw });
    setSubmitting(false);
    if (!res.success) { setError(res.error.message); return; }
    setDone(true);
  }

  return (
    <AuthCard>
      {done ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success"><CheckCircle2 className="size-6" /></span>
          <AuthHeader title="Password set" subtitle="Sign in with your new password." />
          <Button asChild size="md"><a href="/login">Continue to sign-in</a></Button>
        </div>
      ) : (
        <>
          <div className="mb-md flex flex-col items-center text-center"><span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Lock className="size-5" /></span></div>
          <AuthHeader title="Create your password" subtitle="Set a password to secure your new account." />
          {error && <div className="mb-md"><AuthStatus tone="error">{error}</AuthStatus></div>}
          <div className="flex flex-col gap-md">
            <PasswordField label="Password" value={pw} onChange={(v) => { setPw(v); setError(null); }} autoComplete="new-password" />
            <PasswordStrengthMeter password={pw} />
            <PasswordField label="Confirm password" value={confirm} onChange={(v) => { setConfirm(v); setError(null); }} autoComplete="new-password" error={confirm && pw !== confirm ? "Passwords do not match" : undefined} />
            <Button size="md" onClick={submit} disabled={submitting}>{submitting ? "Setting…" : "Set password"}</Button>
          </div>
          <AuthLinkRow><AuthLink href="/login">Back to sign-in</AuthLink></AuthLinkRow>
        </>
      )}
    </AuthCard>
  );
}

export default function SetupPasswordPage() {
  return (
    <AuthShell mobileTagline="Set your password">
      <Suspense fallback={null}>
        <SetupPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
