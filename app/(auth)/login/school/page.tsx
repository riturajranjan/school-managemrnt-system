import { Building2 } from "lucide-react";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";

// Staff sign-in. Multi-tenant "find your school by code" routing is a later
// concern — a real user signs in with their email against the single identity
// system, and the server resolves their tenant/school from real membership.
export default function SchoolLoginPage() {
  return (
    <AuthShell mobileTagline="Sign in to your school">
      <AuthCard>
        <div className="mb-md flex flex-col items-center text-center"><span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="size-5" /></span></div>
        <AuthHeader title="Sign in" subtitle="Use your work email to access your workspace." />
        <LoginForm variant="school" />
        <AuthLinkRow><AuthLink href="/login">Back to sign-in options</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthShell>
  );
}
