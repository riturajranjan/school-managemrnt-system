"use client";

import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";
import { AuthLink, AuthLinkRow, AuthStatus } from "@/components/auth/misc";
import { scorePassword, type MockInvitation } from "@/lib/types/auth";

const INVITE: MockInvitation = { id: "inv-1", schoolName: "Novyra Public School", invitedBy: "Dr. Meera Krishnan (Principal)", role: "Teacher", branch: "Main Campus", email: "new.teacher@novyra.edu.in", expiresAt: "in 5 days" };

export default function AcceptInvitePage() {
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => { if (!name.trim()) { setError("Confirm your name."); return; } if (scorePassword(pw).score < 3) { setError("Choose a stronger password."); return; } setError(null); setDone(true); };

  return (
    <AuthShell mobileTagline="Accept invitation">
      <AuthCard>
        {done ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success"><CheckCircle2 className="size-6" /></span>
            <AuthHeader title="Invitation accepted" />
            <p className="-mt-2 text-sm text-muted-foreground">Welcome to {INVITE.schoolName} (simulation).</p>
            <Button asChild size="md"><a href="/login/staff">Sign in</a></Button>
          </div>
        ) : (
          <>
            <AuthHeader title="You're invited" subtitle={`Join ${INVITE.schoolName} on Novyra Campus OS.`} />
            <div className="mb-md rounded-xl border border-border bg-surface-secondary/40 p-3 text-sm">
              <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><Mail className="size-3.5" /> {INVITE.email}</div>
              <dl className="grid grid-cols-2 gap-y-1 text-xs"><dt className="text-muted-foreground">Role</dt><dd className="text-foreground">{INVITE.role}</dd><dt className="text-muted-foreground">Branch</dt><dd className="text-foreground">{INVITE.branch}</dd><dt className="text-muted-foreground">Invited by</dt><dd className="text-foreground">{INVITE.invitedBy}</dd><dt className="text-muted-foreground">Expires</dt><dd className="text-foreground">{INVITE.expiresAt}</dd></dl>
            </div>
            {error && <div className="mb-md"><AuthStatus tone="error">{error}</AuthStatus></div>}
            <div className="flex flex-col gap-md">
              <div><Label htmlFor="inv-name">Confirm your name</Label><Input id="inv-name" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} /></div>
              <PasswordField label="Set a password" value={pw} onChange={(v) => { setPw(v); setError(null); }} autoComplete="new-password" />
              <PasswordStrengthMeter password={pw} />
              <Button size="md" onClick={submit}>Accept invitation</Button>
            </div>
            <AuthLinkRow><AuthLink href="/login">Already have an account?</AuthLink></AuthLinkRow>
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
