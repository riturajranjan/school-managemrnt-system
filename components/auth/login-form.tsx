"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./password-field";
import { AuthStatus, AuthLink, DemoAccess, SecurityNotice } from "./misc";
import { usePermissions } from "@/components/providers/permissions-provider";
import type { DemoAccount } from "@/lib/types/auth";
import type { UserRole } from "@/lib/permissions/roles";
import { loginAction, type LoginActionResult } from "@/app/(auth)/actions";

type Variant = "school" | "student" | "parent" | "staff" | "super-admin";

const CONFIG: Record<Variant, { idLabel: string; idAutocomplete: string; idPlaceholder: string; idType: string; filter?: (a: DemoAccount) => boolean }> = {
  school: { idLabel: "Email or username", idAutocomplete: "username", idPlaceholder: "you@school.edu", idType: "text" },
  staff: { idLabel: "Employee ID, email or phone", idAutocomplete: "username", idPlaceholder: "EMP-001 or you@school.edu", idType: "text", filter: (a) => !["student", "parent", "super-admin"].includes(a.role) },
  student: { idLabel: "Student ID or email", idAutocomplete: "username", idPlaceholder: "STU-2026-001", idType: "text", filter: (a) => a.role === "student" },
  parent: { idLabel: "Phone or email", idAutocomplete: "username", idPlaceholder: "+91 ••••• ••••• or you@email.com", idType: "text", filter: (a) => a.role === "parent" },
  "super-admin": { idLabel: "Work email", idAutocomplete: "email", idPlaceholder: "you@novyra.io", idType: "email", filter: (a) => a.role === "super-admin" },
};

// Demo Access no longer bypasses auth — it prefills a real seeded development
// email so the user signs in through the real login path (they still enter the
// dev password). Maps demo roles to the users created by prisma/seed.ts.
const SEEDED_EMAIL_BY_ROLE: Partial<Record<UserRole, string>> = {
  "super-admin": "platform.admin@novyra.example",
  administrator: "admin@novyra-demo.example",
  principal: "principal@novyra-demo.example",
  teacher: "teacher@novyra-demo.example",
  librarian: "librarian@novyra-demo.example",
  "transport-manager": "transport@novyra-demo.example",
  "transport-administrator": "transport@novyra-demo.example",
  "hr-manager": "hr@novyra-demo.example",
  "hr-executive": "hr@novyra-demo.example",
};

const ERROR_MESSAGE: Record<Exclude<LoginActionResult, { success: true }>["errorCode"], string> = {
  VALIDATION_ERROR: "Enter a valid email and password.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_INACTIVE: "This account isn't active. Contact your administrator.",
  SERVER_ERROR: "Something went wrong. Please try again.",
};

/** Login form wired to the real email+password Server Action. UI/UX unchanged;
 * only the submit behaviour is real now (no mock accounts, no localStorage). */
export function LoginForm({ variant, returnTo }: { variant: Variant; returnTo?: string | null }) {
  const router = useRouter();
  const { refreshCapabilities } = usePermissions();
  const cfg = CONFIG[variant];
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "signing" | "done">("idle");

  const submit = async () => {
    if (!identifier.trim()) { setError("Enter your " + cfg.idLabel.toLowerCase() + "."); return; }
    if (!password) { setError("Enter your password."); return; }
    setStatus("signing");
    setError(null);
    try {
      const result = await loginAction({ email: identifier.trim(), password, returnTo });
      if (result.success) {
        // PermissionsProvider lives in the root layout, which persists across
        // client-side navigation — its one-time mount effect already ran (as
        // an unauthenticated visitor) before this login, and router.push()
        // alone would never re-trigger it. Without this, the redirected
        // destination renders with the pre-login (anonymous/wrong-role)
        // capabilities until a full page reload remounts the provider.
        // Await the real, now-authenticated capabilities before navigating.
        await refreshCapabilities();
        setStatus("done");
        router.push(result.redirectTo);
        router.refresh();
        return;
      }
      setError(ERROR_MESSAGE[result.errorCode]);
      setStatus("idle");
    } catch {
      setError(ERROR_MESSAGE.SERVER_ERROR);
      setStatus("idle");
    }
  };

  const prefillDemo = (account: DemoAccount) => {
    setIdentifier(SEEDED_EMAIL_BY_ROLE[account.role] ?? account.email);
    setPassword("");
    setError(null);
    setStatus("idle");
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

      <DemoAccess onPick={prefillDemo} filter={cfg.filter} />
      <SecurityNotice />
    </div>
  );
}
