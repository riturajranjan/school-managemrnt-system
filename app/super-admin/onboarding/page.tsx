"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, CheckCircle2, Circle, Rocket, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlans, useTenants } from "@/lib/hooks/use-saas";
import { createTenant } from "@/lib/services/saas-service";
import { cn } from "@/lib/utils";

const STEPS = ["Organization", "Admin", "Plan", "Trial/Sub", "Domain", "Branding", "Modules", "Limits", "Academic", "Review"];

export default function OnboardingPage() {
  const plans = usePlans();
  const tenants = useTenants();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [domain, setDomain] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [planId, setPlanId] = useState(plans.find((p) => p.popular)?.id ?? plans[0]?.id ?? "");
  const [region, setRegion] = useState("India · North");
  const [launched, setLaunched] = useState<string | null>(null);

  const readiness = useMemo(() => [
    { label: "School information", done: name.trim().length > 0 },
    { label: "Admin assigned", done: ownerName.trim().length > 0 && ownerEmail.trim().length > 0 },
    { label: "Plan selected", done: Boolean(planId) },
    { label: "Domain placeholder", done: true },
    { label: "Branding configured", done: true },
    { label: "Modules selected", done: true },
    { label: "Academic session placeholder", done: true },
    { label: "Payment status placeholder", done: true },
  ], [name, ownerName, ownerEmail, planId]);
  const blockers = readiness.filter((r) => !r.done);

  const launch = () => {
    const r = createTenant({ name, code, domain, planId, ownerName, ownerEmail, region });
    if (r.ok && r.tenantId) setLaunched(r.tenantId);
  };

  if (launched) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-md py-2xl text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success"><Rocket className="size-7" /></span>
        <h1 className="text-lg font-semibold text-foreground">{name} launched (simulation)</h1>
        <p className="text-sm text-muted-foreground">The tenant was created in setup-pending status. No real provisioning occurred — this is frontend mock state.</p>
        <div className="flex gap-xs"><Button asChild size="sm"><Link href={`/super-admin/schools/${launched}`}>Open Tenant 360</Link></Button><Button asChild size="sm" variant="outline"><Link href="/super-admin/schools">All schools</Link></Button></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Sparkles className="size-5 text-primary" /> School onboarding</h1><p className="text-xs text-muted-foreground">Create a new tenant · frontend simulation only</p></div>
        <span className="text-xs text-muted-foreground">{tenants.filter((t) => t.status === "setup-pending").length} in setup</span>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-col gap-md">
          {/* Step indicator */}
          <ol className="flex items-center gap-1 overflow-x-auto text-xs">
            {STEPS.map((s, i) => <li key={s} className="flex items-center gap-1"><button type="button" onClick={() => setStep(i)} className={cn("flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-1 font-medium transition", i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-success/15 text-success" : "bg-surface-secondary text-muted-foreground")}>{i < step ? <Check className="size-3" /> : <span className="text-[10px]">{i + 1}</span>} {s}</button>{i < STEPS.length - 1 && <span className="text-muted-foreground">›</span>}</li>)}
          </ol>

          <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            {step === 0 && <><div><Label htmlFor="o-name">School name</Label><Input id="o-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverside International" /></div><div className="grid grid-cols-2 gap-sm"><div><Label htmlFor="o-code">Code</Label><Input id="o-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="RIS" /></div><div><Label>Region</Label><Select value={region} onValueChange={setRegion}><SelectTrigger aria-label="Region"><SelectValue /></SelectTrigger><SelectContent>{["India · North", "India · South", "India · West", "India · East", "UAE"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div></div></>}
            {step === 1 && <><div><Label htmlFor="o-owner">Primary admin name</Label><Input id="o-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></div><div><Label htmlFor="o-email">Admin email</Label><Input id="o-email" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} /></div></>}
            {step === 2 && <div><Label>Plan</Label><Select value={planId} onValueChange={setPlanId}><SelectTrigger aria-label="Plan"><SelectValue /></SelectTrigger><SelectContent>{plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>}
            {step === 4 && <div><Label htmlFor="o-domain">Subdomain / custom domain</Label><Input id="o-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="riverside.novyra.app" /><p className="mt-1 text-xs text-muted-foreground">Domain verification is a placeholder — no DNS checks run.</p></div>}
            {[3, 5, 6, 7, 8].includes(step) && <p className="rounded-md border border-dashed border-border p-md text-sm text-muted-foreground">{STEPS[step]} configuration is a placeholder in this UI phase. Defaults from the selected plan and platform settings will apply.</p>}
            {step === 9 && (
              <div className="flex flex-col gap-sm text-sm">
                <p className="font-semibold text-foreground">Review</p>
                <dl className="grid grid-cols-2 gap-y-1"><dt className="text-muted-foreground">School</dt><dd className="text-foreground">{name || "—"}</dd><dt className="text-muted-foreground">Admin</dt><dd className="text-foreground">{ownerName || "—"}</dd><dt className="text-muted-foreground">Plan</dt><dd className="text-foreground">{plans.find((p) => p.id === planId)?.name}</dd><dt className="text-muted-foreground">Domain</dt><dd className="text-foreground">{domain || "auto"}</dd></dl>
                {blockers.length > 0 && <p className="rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">Resolve {blockers.length} blocker(s) before launch: {blockers.map((b) => b.label).join(", ")}</p>}
              </div>
            )}
            <div className="mt-sm flex justify-between">
              <Button size="sm" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
              {step < STEPS.length - 1 ? <Button size="sm" onClick={() => setStep((s) => s + 1)}>Next</Button> : <Button size="sm" onClick={launch} disabled={blockers.length > 0}><Rocket className="size-3.5" /> Launch (simulation)</Button>}
            </div>
          </div>
        </div>

        {/* Readiness */}
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Launch readiness</h2>
          <div className="flex flex-col gap-1.5">
            {readiness.map((r) => <div key={r.label} className="flex items-center gap-2 text-sm">{r.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-warning" />}<span className={r.done ? "text-foreground" : "text-muted-foreground"}>{r.label}</span></div>)}
          </div>
          {blockers.length === 0 ? <Badge tone="success" className="mt-sm">Ready to launch</Badge> : <Badge tone="warning" className="mt-sm">{blockers.length} blocker(s)</Badge>}
        </div>
      </div>
    </div>
  );
}
