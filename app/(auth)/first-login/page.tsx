"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Check, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { cn } from "@/lib/utils";

const STEPS = ["Profile", "Security", "Preferences", "Done"];

export default function FirstLoginPage() {
  const { theme, setTheme } = useTheme();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Ananya Sharma");
  const [language, setLanguage] = useState("en");
  const [notify, setNotify] = useState(true);
  const [security, setSecurity] = useState<"app" | "sms" | "none">("none");

  return (
    <AuthShell mobileTagline="Finish setting up">
      <AuthCard>
        <AuthHeader title="Welcome to Novyra" subtitle="A few quick preferences and you're in." />
        <ol className="mb-md flex items-center gap-1 text-xs">
          {STEPS.map((s, i) => <li key={s} className="flex items-center gap-1"><span className={cn("flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 font-medium", i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-success/15 text-success" : "bg-surface-secondary text-muted-foreground")}>{i < step ? <Check className="size-3" /> : i + 1} {s}</span>{i < STEPS.length - 1 && <span className="text-muted-foreground">›</span>}</li>)}
        </ol>

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
        {step === 3 && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success"><Rocket className="size-6" /></span>
            <p className="text-sm font-medium text-foreground">You&apos;re all set, {name.split(" ")[0]}!</p>
            <Button asChild size="md"><a href="/teacher/my-day">Go to my dashboard</a></Button>
          </div>
        )}

        {step < 3 && (
          <div className="mt-md flex justify-between">
            <Button size="sm" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>{step === 2 ? "Finish" : "Next"}</Button>
          </div>
        )}
      </AuthCard>
    </AuthShell>
  );
}
