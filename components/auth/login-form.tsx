"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./password-field";
import { AuthStatus, AuthLink, DemoAccess, SecurityNotice } from "./misc";
import { loginAction, type LoginState } from "@/lib/server/actions/auth";

type Variant = "school" | "student" | "parent" | "staff" | "super-admin";

const CONFIG: Record<
  Variant,
  {
    idLabel: string;
    idAutocomplete: string;
    idPlaceholder: string;
    idType: string;
  }
> = {
  school: {
    idLabel: "Email",
    idAutocomplete: "username",
    idPlaceholder: "you@school.edu",
    idType: "text",
  },
  staff: {
    idLabel: "Email",
    idAutocomplete: "username",
    idPlaceholder: "you@school.edu",
    idType: "text",
  },
  student: {
    idLabel: "Email",
    idAutocomplete: "username",
    idPlaceholder: "you@student.edu",
    idType: "text",
  },
  parent: {
    idLabel: "Email",
    idAutocomplete: "username",
    idPlaceholder: "you@email.com",
    idType: "text",
  },
  "super-admin": {
    idLabel: "Work email",
    idAutocomplete: "email",
    idPlaceholder: "you@novyra.io",
    idType: "email",
  },
};

/** Real credential login form. Submits to the `loginAction` Server Action which
 * verifies the password against the database via Better Auth, creates a secure
 * server session and redirects to the resolved next step. No client-side auth,
 * no localStorage, no mock accounts. */
export function LoginForm({ variant }: { variant: Variant }) {
  // useSearchParams needs a Suspense boundary so these pages can be prerendered.
  return (
    <Suspense fallback={<LoginFormInner variant={variant} next="" />}>
      <LoginFormWithParams variant={variant} />
    </Suspense>
  );
}

function LoginFormWithParams({ variant }: { variant: Variant }) {
  const next = useSearchParams().get("next") ?? "";
  return <LoginFormInner variant={variant} next={next} />;
}

function LoginFormInner({ variant, next }: { variant: Variant; next: string }) {
  const cfg = CONFIG[variant];
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-md">
      {state?.error && <AuthStatus tone="error">{state.error}</AuthStatus>}
      <input type="hidden" name="next" value={next} />

      <div>
        <Label htmlFor="auth-id">{cfg.idLabel}</Label>
        <input
          id="auth-id"
          name="identifier"
          type={cfg.idType}
          autoComplete={cfg.idAutocomplete}
          placeholder={cfg.idPlaceholder}
          required
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      {/* PasswordField is controlled for its show/hide toggle; the `name` makes it
          part of the submitted FormData. */}
      <ControlledPassword />

      <div className="flex items-center justify-between text-xs">
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <input type="checkbox" name="remember" defaultChecked /> Remember me
        </label>
        <AuthLink href="/forgot-password">Forgot password?</AuthLink>
      </div>

      <Button size="md" type="submit" disabled={pending}>
        <LogIn className="size-4" /> {pending ? "Signing in…" : "Sign in"}
      </Button>

      <DemoAccess />
      <SecurityNotice />
    </form>
  );
}

function ControlledPassword() {
  const [pw, setPw] = useState("");
  return <PasswordField value={pw} onChange={setPw} name="password" />;
}
