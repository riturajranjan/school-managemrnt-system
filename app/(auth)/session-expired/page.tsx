"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";

export default function SessionExpiredPage() {
  return (
    <AuthCenter>
      <AuthCard>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-warning/15 text-warning"><Clock className="size-6" /></span>
          <AuthHeader title="Your session has expired" />
          <p className="-mt-2 text-sm text-muted-foreground">You&apos;ve been signed out due to inactivity. Sign in again to pick up where you left off.</p>
          <div className="flex w-full flex-col gap-2">
            <Button asChild size="md"><Link href="/login">Sign in again</Link></Button>
            <Button asChild size="md" variant="ghost"><Link href="/login">Return to login</Link></Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Your intended destination is preserved (demo).</p>
        </div>
      </AuthCard>
    </AuthCenter>
  );
}
