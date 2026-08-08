"use client";

import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";

export default function OfflinePage() {
  const router = useRouter();
  return (
    <AuthCenter>
      <AuthCard>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground"><WifiOff className="size-6" /></span>
          <AuthHeader title="No internet connection" />
          <p className="-mt-2 text-sm text-muted-foreground">You appear to be offline. Check your connection and try again.</p>
          <div className="w-full rounded-lg border border-border bg-surface-secondary/40 p-3 text-left text-sm">
            <p className="mb-1 text-xs font-medium text-foreground">Available offline (placeholder)</p>
            <p className="text-xs text-muted-foreground">Recently viewed timetable · cached student list · downloaded documents</p>
          </div>
          <Button size="md" onClick={() => router.refresh()}>Retry</Button>
        </div>
      </AuthCard>
    </AuthCenter>
  );
}
