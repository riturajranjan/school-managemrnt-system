"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { DEMO_ACCOUNTS, isDemoAccessEnabled, type DemoAccount } from "@/lib/types/auth";

/** Small notice explaining that authentication is simulated. */
export function SecurityNotice({ children }: { children?: React.ReactNode }) {
  return (
    <p className="mt-md flex items-start gap-1.5 rounded-md border border-border bg-surface-secondary/40 p-2 text-[11px] text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /> {children ?? "Demo authentication — no credentials are checked and no real session is created."}
    </p>
  );
}

export function AuthStatus({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const map = { error: { cls: "border-error/30 bg-error/8 text-error", Icon: AlertTriangle }, success: { cls: "border-success/30 bg-success/8 text-success", Icon: CheckCircle2 }, info: { cls: "border-primary/25 bg-primary/5 text-primary", Icon: Info } }[tone];
  const Icon = map.Icon;
  return <p role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-1.5 rounded-md border p-2 text-xs ${map.cls}`}><Icon className="mt-0.5 size-3.5 shrink-0" /> <span>{children}</span></p>;
}

/** Subtle "Demo Access" panel — only surfaced in demo/development mode. Lets a
 * reviewer jump into any role without typing credentials. */
export function DemoAccess({ onPick, filter }: { onPick: (a: DemoAccount) => void; filter?: (a: DemoAccount) => boolean }) {
  if (!isDemoAccessEnabled()) return null;
  const accounts = filter ? DEMO_ACCOUNTS.filter(filter) : DEMO_ACCOUNTS;
  return (
    <details className="mt-md rounded-md border border-dashed border-border bg-surface-secondary/30 p-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Demo access (development mode)</summary>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {accounts.map((a) => (
          <button key={a.key} type="button" onClick={() => onPick(a)} className="flex items-center gap-1.5 rounded-md border border-border bg-surface p-1.5 text-left transition hover:border-primary/40">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: a.avatarColor }}>{a.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>
            <span className="min-w-0"><span className="block truncate text-[11px] font-medium text-foreground">{a.label}</span><span className="block truncate text-[9px] text-muted-foreground">{a.name}</span></span>
          </button>
        ))}
      </div>
    </details>
  );
}

export function AuthLinkRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-md flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">{children}</div>;
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-medium text-primary hover:underline">{children}</Link>;
}
