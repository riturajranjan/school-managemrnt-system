"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Building2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AuthCard, AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { SelectCard, Avatar } from "@/components/auth/selectors";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";
import { MOCK_SCHOOLS, type MockSchoolAccess } from "@/lib/types/auth";

export default function SmartSchoolLoginPage() {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<MockSchoolAccess | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_SCHOOLS.filter((s) => s.favorite || s.lastAccessed);
    return MOCK_SCHOOLS.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.city.toLowerCase().includes(q));
  }, [query]);

  return (
    <AuthShell mobileTagline="Find your school">
      <AuthCard>
        {!picked ? (
          <>
            <AuthHeader title="Find your school" subtitle="Enter your school code, domain or name." />
            <div className="relative mb-md"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. NVX-001 or Novyra" aria-label="School code, domain or name" className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{query ? "Matches" : "Recent schools"}</p>
            <div className="flex flex-col gap-2">
              {matches.map((s) => (
                <SelectCard key={s.id} onClick={() => setPicked(s)} disabled={s.status === "inactive"}>
                  <Avatar text={s.code.slice(0, 2)} color={s.logoColor} />
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{s.name}</span><span className="block truncate text-xs text-muted-foreground">{s.city} · {s.board} · {s.branchCount} branches</span></span>
                  {s.status === "inactive" && <Badge tone="error">Inactive</Badge>}
                </SelectCard>
              ))}
              {matches.length === 0 && <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No schools found for “{query}”.</p>}
            </div>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setPicked(null)} className="mb-sm flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Use another school</button>
            <div className="mb-md flex items-center gap-3 rounded-xl border border-border bg-surface-secondary/40 p-3">
              <Avatar text={picked.code.slice(0, 2)} color={picked.logoColor} className="size-11" />
              <div className="min-w-0"><p className="flex items-center gap-1 truncate text-sm font-semibold text-foreground"><Building2 className="size-3.5" /> {picked.name}</p><p className="truncate text-xs text-muted-foreground">{picked.code} · {picked.city} · {picked.board}</p></div>
              <Badge tone="success" className="ml-auto">Active</Badge>
            </div>
            <LoginForm variant="school" />
          </>
        )}
        <AuthLinkRow><AuthLink href="/login">Back to sign-in</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthShell>
  );
}
