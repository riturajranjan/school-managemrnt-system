"use client";

import { QrCode } from "lucide-react";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";

export default function StudentLoginPage() {
  return (
    <AuthShell mobileTagline="Student sign-in">
      <AuthCard>
        <AuthHeader title="Student sign-in" subtitle="Access your classes, homework and results." />
        <LoginForm variant="student" />
        <div className="mt-md flex items-center justify-center gap-1 rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
          <QrCode className="size-3.5" /> QR sign-in coming soon
        </div>
        <AuthLinkRow>
          <AuthLink href="/login">Switch account type</AuthLink>
        </AuthLinkRow>
      </AuthCard>
    </AuthShell>
  );
}
