"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { SEEDED_DEMO_ACCOUNTS } from "@/lib/auth/demo-accounts";
import { devDemoLoginAction, type LoginState } from "@/lib/server/actions/auth";

/** Small security reassurance notice shown under the sign-in form. */
export function SecurityNotice({ children }: { children?: React.ReactNode }) {
  return (
    <p className="mt-md flex items-start gap-1.5 rounded-md border border-border bg-surface-secondary/40 p-2 text-[11px] text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /> {children ?? "Your connection is encrypted. We never store your password in plain text."}
    </p>
  );
}

export function AuthStatus({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const map = { error: { cls: "border-error/30 bg-error/8 text-error", Icon: AlertTriangle }, success: { cls: "border-success/30 bg-success/8 text-success", Icon: CheckCircle2 }, info: { cls: "border-primary/25 bg-primary/5 text-primary", Icon: Info } }[tone];
  const Icon = map.Icon;
  return <p role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-1.5 rounded-md border p-2 text-xs ${map.cls}`}><Icon className="mt-0.5 size-3.5 shrink-0" /> <span>{children}</span></p>;
}

/** Dev-only "Demo Access" panel. Each button performs a REAL Better Auth sign-in
 * for a seeded account via the devDemoLoginAction Server Action (using the
 * server-side dev password) — it never fabricates a session or touches
 * localStorage. Hidden entirely in production builds. */
export function DemoAccess() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(devDemoLoginAction, undefined);
  if (process.env.NODE_ENV === "production") return null;

  return (
    <details className="mt-md rounded-md border border-dashed border-border bg-surface-secondary/30 p-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Demo access (development only)</summary>
      {state?.error && <p className="mt-2 text-[11px] text-error">{state.error}</p>}
      <form action={formAction} className="mt-2 grid grid-cols-2 gap-1.5">
        {SEEDED_DEMO_ACCOUNTS.map((a) => (
          <button key={a.email} type="submit" name="email" value={a.email} disabled={pending}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface p-1.5 text-left transition hover:border-primary/40 disabled:opacity-50">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: a.color }}>{a.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>
            <span className="min-w-0"><span className="block truncate text-[11px] font-medium text-foreground">{a.label}</span><span className="block truncate text-[9px] text-muted-foreground">{a.name}</span></span>
          </button>
        ))}
      </form>
    </details>
  );
}

export function AuthLinkRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-md flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">{children}</div>;
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-medium text-primary hover:underline">{children}</Link>;
}
