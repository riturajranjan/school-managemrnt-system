"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { OtpInput } from "@/components/auth/otp-input";
import { AuthLink, AuthStatus, SecurityNotice } from "@/components/auth/misc";

export default function VerifyOtpPage() {
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (seconds <= 0) return; const t = setTimeout(() => setSeconds((s) => s - 1), 1000); return () => clearTimeout(t); }, [seconds]);

  const submit = () => { if (code.length < 6) { setError("Enter the 6-digit code."); return; } setError(null); setVerified(true); };

  return (
    <AuthShell mobileTagline="Verify it's you">
      <AuthCard>
        {verified ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success"><CheckCircle2 className="size-6" /></span>
            <AuthHeader title="Verified" />
            <p className="-mt-2 text-sm text-muted-foreground">Your identity has been confirmed (simulation).</p>
            <Button asChild size="md"><Link href="/">Continue</Link></Button>
          </div>
        ) : (
          <>
            <div className="mb-md flex flex-col items-center text-center"><span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="size-5" /></span></div>
            <AuthHeader title="Enter verification code" subtitle="We sent a 6-digit code to +91 ••••• ••210." />
            {error && <div className="mb-md"><AuthStatus tone="error">{error}</AuthStatus></div>}
            <div className="mt-md"><OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} /></div>
            <Button size="md" className="mt-md w-full" onClick={submit} disabled={code.length < 6}>Verify</Button>
            <div className="mt-md flex items-center justify-between text-xs text-muted-foreground">
              {seconds > 0 ? <span>Resend in {seconds}s</span> : <button type="button" onClick={() => setSeconds(30)} className="font-medium text-primary hover:underline">Resend code</button>}
              <AuthLink href="/verify-otp">Change contact</AuthLink>
            </div>
            <SecurityNotice>Demo verification — no real OTP is sent. Enter any 6 digits.</SecurityNotice>
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
