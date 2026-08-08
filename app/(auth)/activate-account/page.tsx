"use client";

import { useState } from "react";
import { BadgeCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { OtpInput } from "@/components/auth/otp-input";
import { AuthLink, AuthLinkRow, AuthStatus, SecurityNotice } from "@/components/auth/misc";

export default function ActivateAccountPage() {
  const [code, setCode] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => { if (code.length < 6) { setError("Enter the 6-digit activation code."); return; } setError(null); setDone(true); };

  return (
    <AuthShell mobileTagline="Activate your account">
      <AuthCard>
        {done ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success"><CheckCircle2 className="size-6" /></span>
            <AuthHeader title="Account activated" />
            <p className="-mt-2 text-sm text-muted-foreground">Set your password to finish (simulation).</p>
            <Button asChild size="md"><a href="/setup-password">Set password</a></Button>
          </div>
        ) : (
          <>
            <div className="mb-md flex flex-col items-center text-center"><span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><BadgeCheck className="size-5" /></span></div>
            <AuthHeader title="Activate your account" subtitle="Enter the activation code from your welcome message." />
            {error && <div className="mb-md"><AuthStatus tone="error">{error}</AuthStatus></div>}
            <div className="mt-md"><OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} /></div>
            <Button size="md" className="mt-md w-full" onClick={submit} disabled={code.length < 6}>Activate</Button>
            <AuthLinkRow><AuthLink href="/login">Back to sign-in</AuthLink></AuthLinkRow>
            <SecurityNotice>Demo activation — enter any 6 digits.</SecurityNotice>
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
