"use client";

import { Smartphone } from "lucide-react";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";

export default function ParentLoginPage() {
  return (
    <AuthShell mobileTagline="Parent sign-in">
      <AuthCard>
        <AuthHeader title="Parent sign-in" subtitle="Follow your child's progress, fees and updates." />
        <LoginForm variant="parent" />
        <div className="mt-md flex items-center justify-center gap-1 rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
          <Smartphone className="size-3.5" /> OTP sign-in coming soon · <AuthLink href="/verify-otp">Preview</AuthLink>
        </div>
        <AuthLinkRow>
          <AuthLink href="/login">Switch account type</AuthLink>
        </AuthLinkRow>
      </AuthCard>
    </AuthShell>
  );
}
