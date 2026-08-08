import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/** Standalone layout for all authentication & full-screen access pages. Renders
 * OUTSIDE the dashboard shell (AppShell bypasses these routes). Theme-aware. */
export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-[--auth-bg] text-foreground" style={{ ["--auth-bg" as string]: "var(--color-background)" }}>
      <div className="pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-2 pointer-events-auto">
        <ThemeToggle />
      </div>

      <main className="flex flex-1 flex-col">{children}</main>

      <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-md py-3 text-[11px] text-muted-foreground">
        <Link href="/settings/privacy" className="hover:text-foreground">Privacy</Link>
        <Link href="/settings/terms" className="hover:text-foreground">Terms</Link>
        <Link href="/helpdesk" className="hover:text-foreground">Help</Link>
        <span aria-hidden>·</span>
        <span>© 2026 Novyra Campus OS</span>
        <span className="hidden sm:inline">· Demo authentication — no real sign-in</span>
      </footer>
    </div>
  );
}
