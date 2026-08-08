"use client";

import { useState } from "react";
import { KeyRound, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { AuthLink, AuthLinkRow, AuthStatus, SecurityNotice } from "@/components/auth/misc";

export default function ForgotPasswordPage() {
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => { if (!contact.trim()) { setError("Enter your email or phone."); return; } setError(null); setSent(true); };

  return (
    <AuthShell mobileTagline="Recover your account">
      <AuthCard>
        {sent ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success"><MailCheck className="size-6" /></span>
            <AuthHeader title="Check your inbox" />
            <p className="-mt-2 text-sm text-muted-foreground">If an account exists for <span className="font-medium text-foreground">{contact}</span>, we&apos;ll send recovery instructions.</p>
            <AuthStatus tone="info">Demo recovery flow completed — no email was actually sent.</AuthStatus>
            <Button asChild size="md" variant="outline"><a href="/login">Back to sign-in</a></Button>
          </div>
        ) : (
          <>
            <div className="mb-md flex flex-col items-center text-center"><span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><KeyRound className="size-5" /></span></div>
            <AuthHeader title="Forgot password?" subtitle="We'll send recovery instructions to your registered contact." />
            {error && <AuthStatus tone="error">{error}</AuthStatus>}
            <div className="mt-md"><Label htmlFor="fp-contact">Email or phone</Label><input id="fp-contact" type="text" autoComplete="username" value={contact} onChange={(e) => { setContact(e.target.value); setError(null); }} placeholder="you@school.edu" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /></div>
            <Button size="md" className="mt-md w-full" onClick={submit}>Send recovery instructions</Button>
            <AuthLinkRow><AuthLink href="/login">Back to sign-in</AuthLink></AuthLinkRow>
            <SecurityNotice />
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
