"use client";

import Link from "next/link";
import { useState } from "react";
import { GraduationCap, School, ShieldCheck, UserCog, Users } from "lucide-react";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";
import { cn } from "@/lib/utils";

const TYPES = [
  { key: "school", label: "Staff", icon: UserCog, href: "/login/staff" },
  { key: "student", label: "Student", icon: GraduationCap, href: "/login/student" },
  { key: "parent", label: "Parent", icon: Users, href: "/login/parent" },
] as const;

export function LoginView({ returnTo }: { returnTo?: string | null }) {
  const [type] = useState<"school">("school");

  return (
    <AuthShell mobileTagline="Sign in to continue">
      <AuthCard>
        <AuthHeader title="Welcome back" subtitle="Sign in to your Novyra Campus OS workspace." />

        {/* Login type switcher (progressive disclosure — full forms live on dedicated routes) */}
        <div className="mb-md grid grid-cols-3 gap-1.5">
          {TYPES.map((t) => (
            <Link key={t.key} href={t.href} className={cn("flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition", t.key === type ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
              <t.icon className="size-4" /> {t.label}
            </Link>
          ))}
        </div>

        <LoginForm variant="school" returnTo={returnTo} />

        <AuthLinkRow>
          <span className="flex items-center gap-1"><School className="size-3.5" /> <AuthLink href="/select-school">Choose a school</AuthLink></span>
          <span className="flex items-center gap-1"><ShieldCheck className="size-3.5" /> <AuthLink href="/login/super-admin">Platform admin</AuthLink></span>
        </AuthLinkRow>
      </AuthCard>
    </AuthShell>
  );
}
