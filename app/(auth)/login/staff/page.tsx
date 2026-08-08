"use client";

import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";

export default function StaffLoginPage() {
  return (
    <AuthShell mobileTagline="Staff sign-in">
      <AuthCard>
        <AuthHeader title="Staff sign-in" subtitle="Teachers, administrators and school staff." />
        <LoginForm variant="staff" />
        <AuthLinkRow>
          <AuthLink href="/login">Not staff? Switch</AuthLink>
          <AuthLink href="/accept-invite">Have an invite?</AuthLink>
        </AuthLinkRow>
      </AuthCard>
    </AuthShell>
  );
}
