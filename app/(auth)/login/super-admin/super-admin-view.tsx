"use client";

import { Command } from "lucide-react";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";

export function SuperAdminLoginView() {
  return (
    <AuthCenter>
      <div className="mb-md flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#022c43,#0a3a52)] text-white"><Command className="size-6" /></span>
        <div><p className="text-sm font-bold text-foreground">Novyra Campus OS</p><p className="text-xs text-muted-foreground">Platform administration</p></div>
      </div>
      <AuthCard>
        <AuthHeader title="Platform sign-in" subtitle="Restricted to Novyra platform team members." />
        <LoginForm variant="super-admin" />
        <AuthLinkRow>
          <AuthLink href="/login">School sign-in</AuthLink>
          <span className="text-muted-foreground">Platform Admin · Support · Billing · Auditor</span>
        </AuthLinkRow>
      </AuthCard>
    </AuthCenter>
  );
}
