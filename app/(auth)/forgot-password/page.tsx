"use client";

import { useActionState } from "react";
import { KeyRound, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { AuthLink, AuthLinkRow, AuthStatus, SecurityNotice } from "@/components/auth/misc";
import { requestPasswordResetAction, type PasswordState } from "@/lib/server/actions/password";

// Real forgot-password. Submits to requestPasswordResetAction, which asks Better
// Auth to mint a one-time reset token and deliver the link via the email adapter
// (dev: logged to the server console). The response is ALWAYS generic — it never
// reveals whether an account exists.
export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(requestPasswordResetAction, undefined);

  return (
    <AuthShell mobileTagline="Recover your account">
      <AuthCard>
        {state?.sent ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success"><MailCheck className="size-6" /></span>
            <AuthHeader title="Check your inbox" />
            <p className="-mt-2 text-sm text-muted-foreground">If an account matches that email, we&apos;ll send recovery instructions shortly.</p>
            <Button asChild size="md" variant="outline"><a href="/login">Back to sign-in</a></Button>
          </div>
        ) : (
          <form action={formAction}>
            <div className="mb-md flex flex-col items-center text-center"><span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><KeyRound className="size-5" /></span></div>
            <AuthHeader title="Forgot password?" subtitle="We'll send recovery instructions to your registered email." />
            {state?.error && <AuthStatus tone="error">{state.error}</AuthStatus>}
            <div className="mt-md"><Label htmlFor="fp-email">Email</Label><input id="fp-email" name="email" type="email" autoComplete="email" required placeholder="you@school.edu" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /></div>
            <Button size="md" type="submit" className="mt-md w-full" disabled={pending}>{pending ? "Sending…" : "Send recovery instructions"}</Button>
            <AuthLinkRow><AuthLink href="/login">Back to sign-in</AuthLink></AuthLinkRow>
            <SecurityNotice />
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
