"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";
import { AuthStatus } from "@/components/auth/misc";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function AccessDeniedPage() {
  const { role } = usePermissions();
  const [requested, setRequested] = useState(false);
  return (
    <AuthCenter>
      <AuthCard>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-error/15 text-error"><ShieldX className="size-6" /></span>
          <AuthHeader title="Access denied" />
          <p className="-mt-2 text-sm text-muted-foreground">You don&apos;t have permission to view this area.</p>
          <dl className="w-full rounded-lg border border-border bg-surface-secondary/40 p-3 text-left text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Your role</dt><dd className="text-foreground">{roleLabels[role]}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Requested area</dt><dd className="text-foreground">Restricted section</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Reason</dt><dd className="text-foreground">Insufficient permissions</dd></div>
          </dl>
          {requested && <AuthStatus tone="info">Access request sent to your administrator (simulation).</AuthStatus>}
          <div className="flex w-full flex-col gap-2">
            <Button asChild size="md"><Link href="/">Return to dashboard</Link></Button>
            <Button size="md" variant="outline" onClick={() => setRequested(true)} disabled={requested}>Request access</Button>
          </div>
        </div>
      </AuthCard>
    </AuthCenter>
  );
}
