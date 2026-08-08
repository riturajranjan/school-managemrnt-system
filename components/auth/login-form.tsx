"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./password-field";
import { AuthStatus, AuthLink, DemoAccess, SecurityNotice } from "./misc";
import { DEMO_ACCOUNTS, redirectForRole, type DemoAccount } from "@/lib/types/auth";

type Variant = "school" | "student" | "parent" | "staff" | "super-admin";

const CONFIG: Record<Variant, { idLabel: string; idAutocomplete: string; idPlaceholder: string; idType: string; filter?: (a: DemoAccount) => boolean }> = {
  school: { idLabel: "Email or username", idAutocomplete: "username", idPlaceholder: "you@school.edu", idType: "text" },
  staff: { idLabel: "Employee ID, email or phone", idAutocomplete: "username", idPlaceholder: "EMP-001 or you@school.edu", idType: "text", filter: (a) => !["student", "parent", "super-admin"].includes(a.role) },
  student: { idLabel: "Student ID or email", idAutocomplete: "username", idPlaceholder: "STU-2026-001", idType: "text", filter: (a) => a.role === "student" },
  parent: { idLabel: "Phone or email", idAutocomplete: "username", idPlaceholder: "+91 ••••• ••••• or you@email.com", idType: "text", filter: (a) => a.role === "parent" },
  "super-admin": { idLabel: "Work email", idAutocomplete: "email", idPlaceholder: "you@novyra.io", idType: "email", filter: (a) => a.role === "super-admin" },
};

/** Reusable simulated login form. On "sign in" it validates presence only, then
 * routes to the correct next step (role/child selection) or the role dashboard.
 * NO real authentication occurs. */
export function LoginForm({ variant }: { variant: Variant }) {
  const router = useRouter();
  const cfg = CONFIG[variant];
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "signing" | "done">("idle");

  const go = (account: DemoAccount) => {
    setStatus("signing");
    setError(null);
    // Simulate a brief sign-in, then route based on the account shape.
    setTimeout(() => {
      if (account.multiRole && account.multiRole.length > 1) { router.push("/select-role"); return; }
      if (account.role === "parent" && account.children && account.children.length > 1) { router.push("/select-child"); return; }
      router.push(redirectForRole(account.role));
    }, 550);
  };

  const submit = () => {
    if (!identifier.trim()) { setError("Enter your " + cfg.idLabel.toLowerCase() + "."); return; }
    if (!password) { setError("Enter your password."); return; }
    // Match a demo account by email/name prefix; otherwise use the first eligible.
    const pool = cfg.filter ? DEMO_ACCOUNTS.filter(cfg.filter) : DEMO_ACCOUNTS;
    const match = pool.find((a) => a.email.toLowerCase() === identifier.trim().toLowerCase()) ?? pool[0];
    if (!match) { setError("No account found for this sign-in type."); return; }
    go(match);
  };

  return (
    <div className="flex flex-col gap-md">
      {error && <AuthStatus tone="error">{error}</AuthStatus>}

      <div>
        <Label htmlFor="auth-id">{cfg.idLabel}</Label>
        <input id="auth-id" type={cfg.idType} inputMode={variant === "parent" ? "text" : undefined} autoComplete={cfg.idAutocomplete} value={identifier} onChange={(e) => { setIdentifier(e.target.value); setError(null); }} placeholder={cfg.idPlaceholder}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
      </div>

      <PasswordField value={password} onChange={(v) => { setPassword(v); setError(null); }} />

      <div className="flex items-center justify-between text-xs">
        <label className="flex items-center gap-1.5 text-muted-foreground"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
        <AuthLink href="/forgot-password">Forgot password?</AuthLink>
      </div>

      <Button size="md" onClick={submit} disabled={status === "signing"}>
        <LogIn className="size-4" /> {status === "signing" ? "Signing in…" : "Sign in"}
      </Button>

      <DemoAccess onPick={go} filter={cfg.filter} />
      <SecurityNotice />
    </div>
  );
}
