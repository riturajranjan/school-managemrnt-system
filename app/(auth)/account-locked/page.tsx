"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";

export default function AccountLockedPage() {
  return (
    <AuthCenter>
      <AuthCard>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-error/15 text-error"><Lock className="size-6" /></span>
          <AuthHeader title="Account locked" />
          <p className="-mt-2 text-sm text-muted-foreground">For your security, this account has been temporarily locked. Please contact your administrator or recover your account to continue.</p>
          <div className="flex w-full flex-col gap-2">
            <Button asChild size="md"><Link href="/forgot-password">Recover account</Link></Button>
            <Button asChild size="md" variant="outline"><Link href="/helpdesk">Contact administrator</Link></Button>
            <Button asChild size="md" variant="ghost"><Link href="/login">Back to sign-in</Link></Button>
          </div>
        </div>
      </AuthCard>
    </AuthCenter>
  );
}
