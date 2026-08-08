"use client";

import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { AuthLink, AuthLinkRow, AuthStatus, SecurityNotice } from "@/components/auth/misc";

export default function VerifyEmailPage() {
  const [verified, setVerified] = useState(false);
  const [resent, setResent] = useState(false);

  return (
    <AuthShell mobileTagline="Verify your email">
      <AuthCard>
        {verified ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success"><CheckCircle2 className="size-6" /></span>
            <AuthHeader title="Email verified" />
            <p className="-mt-2 text-sm text-muted-foreground">Thanks — your email address is confirmed (simulation).</p>
            <Button asChild size="md"><a href="/login">Continue to sign-in</a></Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Mail className="size-6" /></span>
            <AuthHeader title="Verify your email" />
            <p className="-mt-2 text-sm text-muted-foreground">We sent a verification link to <span className="font-medium text-foreground">aarav@student.novyra.edu.in</span>.</p>
            {resent && <AuthStatus tone="info">Verification email re-sent (simulation).</AuthStatus>}
            <div className="flex w-full flex-col gap-2">
              <Button size="md" onClick={() => setVerified(true)}>Open mail (simulate verified)</Button>
              <Button size="md" variant="outline" onClick={() => setResent(true)}>Resend email</Button>
            </div>
            <AuthLinkRow><AuthLink href="/login">Change email</AuthLink></AuthLinkRow>
            <SecurityNotice>Demo verification — no real email is sent.</SecurityNotice>
          </div>
        )}
      </AuthCard>
    </AuthShell>
  );
}
