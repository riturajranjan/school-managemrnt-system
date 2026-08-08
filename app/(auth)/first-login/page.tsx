"use client";

import { useActionState, useState } from "react";
import { useTheme } from "next-themes";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { AuthStatus } from "@/components/auth/misc";
import { useSession } from "@/lib/auth/client";
import { completeProfileAction, type SetupState } from "@/lib/server/actions/setup";
import { cn } from "@/lib/utils";

const STEPS = ["Profile", "Security", "Preferences"];

// First-login setup. Steps 0–1 collect UI-only preferences (theme/language/2FA
// intent — these do not gate access); the final step submits the real
// `completeProfileAction`, which stamps profileCompletedAt in the database and
// hands off to the resolver for the correct dashboard. No mock identity.
export default function FirstLoginPage() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [step, setStep] = useState(0);
  // `typed` is null until the user edits; the displayed name derives from the
  // real session name until then (no effect/setState-in-render churn).
  const [typed, setTyped] = useState<string | null>(null);
  const name = typed ?? session?.user?.name ?? "";
  const setName = setTyped;
  const [language, setLanguage] = useState("en");
  const [notify, setNotify] = useState(true);
  const [security, setSecurity] = useState<"app" | "sms" | "none">("none");
  const [state, formAction, pending] = useActionState<SetupState, FormData>(completeProfileAction, undefined);

  return (
    <AuthShell mobileTagline="Finish setting up">
      <AuthCard>
        <AuthHeader title="Welcome to Novyra" subtitle="A few quick preferences and you're in." />
        <ol className="mb-md flex items-center gap-1 text-xs">
          {STEPS.map((s, i) => <li key={s} className="flex items-center gap-1"><span className={cn("flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 font-medium", i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-success/15 text-success" : "bg-surface-secondary text-muted-foreground")}>{i < step ? <Check className="size-3" /> : i + 1} {s}</span>{i < STEPS.length - 1 && <span className="text-muted-foreground">›</span>}</li>)}
        </ol>

        {state?.error && <div className="mb-md"><AuthStatus tone="error">{state.error}</AuthStatus></div>}

        <form action={formAction}>
          {/* Confirmed name travels with the final submit regardless of step. */}
          <input type="hidden" name="name" value={name} />

          {step === 0 && <div className="flex flex-col gap-sm"><div><Label htmlFor="fl-name">Confirm your name</Label><Input id="fl-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div><p className="text-xs text-muted-foreground">You can change this later in your profile.</p></div>}
          {step === 1 && (
            <div className="flex flex-col gap-sm">
              <p className="text-sm text-foreground">Add a second layer of security?</p>
              {([["app", "Authenticator app"], ["sms", "SMS code (future)"], ["none", "Not now"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setSecurity(k)} className={cn("flex items-center justify-between rounded-md border p-2 text-sm transition", security === k ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}><span className="text-foreground">{l}</span>{security === k && <Check className="size-4 text-primary" />}</button>
              ))}
              <p className="text-[11px] text-muted-foreground">Two-step verification requires backend integration — this only records your preference.</p>
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col gap-sm">
              <div><Label>Language</Label><Select value={language} onValueChange={setLanguage}><SelectTrigger aria-label="Language"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="hi">हिन्दी (Hindi)</SelectItem></SelectContent></Select></div>
              <div><Label>Theme</Label><Select value={theme ?? "system"} onValueChange={setTheme}><SelectTrigger aria-label="Theme"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select></div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Enable in-app notifications</label>
            </div>
          )}

          <div className="mt-md flex justify-between">
            <Button size="sm" type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>Back</Button>
            {step < 2 ? (
              <Button size="sm" type="button" onClick={() => setStep((s) => s + 1)} disabled={step === 0 && name.trim().length < 2}>Next</Button>
            ) : (
              <Button size="sm" type="submit" disabled={pending}>{pending ? "Finishing…" : "Finish setup"}</Button>
            )}
          </div>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
