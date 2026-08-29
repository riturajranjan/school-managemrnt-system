"use client";

// This page was an unreferenced mock (fake 2FA/recovery/devices links, fake
// login history, frontend-only preference toggles — see git history). It was
// never linked from the avatar dropdown or anywhere else in the app. The
// avatar dropdown's real "Account Settings" now covers real password change
// + real active sessions at /account — redirect there rather than keep two
// competing personal-security pages.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SecurityRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/account");
  }, [router]);
  return <div className="py-2xl text-center text-sm text-muted-foreground">Redirecting to Account Settings…</div>;
}
