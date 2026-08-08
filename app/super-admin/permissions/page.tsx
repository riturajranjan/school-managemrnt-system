"use client";

import { useState } from "react";
import { Check, Minus, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { platformRoleLabels, type PlatformArea, type PlatformRole } from "@/lib/types/saas";
import { cn } from "@/lib/utils";

const AREAS: { key: PlatformArea; label: string }[] = [
  { key: "schools", label: "Schools" }, { key: "plans", label: "Plans" }, { key: "billing", label: "Billing" }, { key: "support", label: "Support" },
  { key: "domains", label: "Domains" }, { key: "marketplace", label: "Marketplace" }, { key: "announcements", label: "Announcements" }, { key: "settings", label: "Platform settings" }, { key: "audit", label: "Audit" },
];

// Static platform RBAC matrix (frontend simulation — not enforced).
const MATRIX: Record<PlatformRole, Partial<Record<PlatformArea, "manage" | "view">>> = {
  "platform-owner": { schools: "manage", plans: "manage", billing: "manage", support: "manage", domains: "manage", marketplace: "manage", announcements: "manage", settings: "manage", audit: "view" },
  "super-admin": { schools: "manage", plans: "manage", billing: "view", support: "manage", domains: "manage", marketplace: "manage", announcements: "manage", settings: "view", audit: "view" },
  "billing-admin": { schools: "view", plans: "view", billing: "manage", support: "view", audit: "view" },
  "support-admin": { schools: "view", support: "manage", domains: "view", audit: "view" },
  "customer-success": { schools: "view", support: "manage", announcements: "view" },
  auditor: { schools: "view", plans: "view", billing: "view", support: "view", domains: "view", marketplace: "view", announcements: "view", settings: "view", audit: "view" },
};

export default function PlatformPermissionsPage() {
  const [role, setRole] = useState<PlatformRole>("super-admin");
  const roles = Object.keys(platformRoleLabels) as PlatformRole[];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><ShieldCheck className="size-5 text-primary" /> Super Admin permissions</h1><p className="text-xs text-muted-foreground">Platform operations access · frontend simulation</p></div>
        <Select value={role} onValueChange={(v) => setRole(v as PlatformRole)}><SelectTrigger aria-label="Role" className="w-52"><SelectValue /></SelectTrigger><SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{platformRoleLabels[r]}</SelectItem>)}</SelectContent></Select>
      </div>

      {/* Desktop matrix */}
      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full min-w-max text-sm">
          <thead><tr className="border-b border-border bg-surface-secondary/60 text-xs text-muted-foreground"><th className="px-sm py-2 text-left">Area</th>{roles.map((r) => <th key={r} className={cn("px-sm py-2 text-center", r === role && "text-primary")}>{platformRoleLabels[r].split(" ")[0]}</th>)}</tr></thead>
          <tbody>
            {AREAS.map((a) => (
              <tr key={a.key} className="border-b border-border/60">
                <th scope="row" className="px-sm py-2 text-left font-medium text-foreground">{a.label}</th>
                {roles.map((r) => { const lvl = MATRIX[r][a.key]; return <td key={r} className={cn("px-sm py-2 text-center", r === role && "bg-primary/5")}>{lvl === "manage" ? <Check className="mx-auto size-4 text-success" /> : lvl === "view" ? <span className="text-xs text-info">view</span> : <Minus className="mx-auto size-3.5 text-muted-foreground" />}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — selected role cards */}
      <div className="flex flex-col gap-xs sm:hidden">
        {AREAS.map((a) => { const lvl = MATRIX[role][a.key]; return <div key={a.key} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm"><span className="text-foreground">{a.label}</span><span className={cn("rounded-pill px-2 py-0.5 text-[11px]", lvl === "manage" ? "bg-success/10 text-success" : lvl === "view" ? "bg-info/10 text-info" : "bg-surface-secondary text-muted-foreground")}>{lvl ?? "none"}</span></div>; })}
      </div>
      <p className="text-xs text-muted-foreground">Platform RBAC is documented here but not enforced without a backend.</p>
    </div>
  );
}
