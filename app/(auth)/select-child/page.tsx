import Link from "next/link";
import { Users } from "lucide-react";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";
import { Button } from "@/components/ui/button";

// Parent → child selection. The authoritative Student/Guardian relationship
// lives in the Phase 17 domain, which is NOT part of this phase. The screen is
// intentionally kept (design preserved) but shows a PENDING state rather than
// faking mock children as authoritative. It will be wired to real linked
// children once Phase 17 lands.
export default function SelectChildPage() {
  return (
    <AuthCenter>
      <AuthCard>
        <AuthHeader title="Choose a child" subtitle="Select whose dashboard you'd like to open." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface-secondary/40 p-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="size-6" /></span>
          <p className="text-sm font-medium text-foreground">Child linking is coming with Phase 17</p>
          <p className="text-xs text-muted-foreground">Guardian–student relationships aren&apos;t part of this release yet, so no children are linked to your account. Authentication itself is fully active.</p>
          <Button asChild size="md"><Link href="/parent/activities">Continue to parent home</Link></Button>
        </div>
        <AuthLinkRow><AuthLink href="/login">Sign out</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthCenter>
  );
}
