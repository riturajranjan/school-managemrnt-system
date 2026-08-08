"use client";

import Link from "next/link";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";

export default function MaintenancePage() {
  return (
    <AuthCenter>
      <AuthCard>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#022c43,#18b0c8)] text-white"><Wrench className="size-6" /></span>
          <AuthHeader title="We'll be right back" />
          <p className="-mt-2 text-sm text-muted-foreground">Novyra Campus OS is undergoing scheduled maintenance. Thanks for your patience.</p>
          <div className="w-full rounded-lg border border-border bg-surface-secondary/40 p-3 text-left text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-foreground">Maintenance</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expected back</span><span className="text-foreground">Shortly (placeholder)</span></div>
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button asChild size="md" variant="outline"><Link href="/helpdesk">Contact support</Link></Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Demo status — no live uptime is monitored.</p>
        </div>
      </AuthCard>
    </AuthCenter>
  );
}
