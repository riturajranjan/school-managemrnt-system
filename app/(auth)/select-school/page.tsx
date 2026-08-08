"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";
import { SelectCard, Avatar } from "@/components/auth/selectors";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";
import { MOCK_SCHOOLS } from "@/lib/types/auth";
import { roleLabels } from "@/lib/permissions/roles";

export default function SelectSchoolPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const schools = useMemo(() => { const q = query.trim().toLowerCase(); return q ? MOCK_SCHOOLS.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)) : MOCK_SCHOOLS; }, [query]);

  return (
    <AuthCenter>
      <AuthCard>
        <AuthHeader title="Choose a school" subtitle="You have access to multiple schools." />
        <div className="relative mb-md"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search schools…" aria-label="Search schools" className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>
        <div className="flex flex-col gap-2">
          {schools.map((s) => (
            <SelectCard key={s.id} onClick={() => router.push("/select-branch")} disabled={s.status === "inactive"}>
              <Avatar text={s.code.slice(0, 2)} color={s.logoColor} />
              <span className="min-w-0"><span className="flex items-center gap-1 truncate text-sm font-medium text-foreground">{s.name} {s.favorite && <Star className="size-3 fill-warning text-warning" />}</span><span className="block truncate text-xs text-muted-foreground">{roleLabels.administrator} · {s.city}{s.lastAccessed ? ` · ${s.lastAccessed}` : ""}</span></span>
              {s.status === "inactive" && <Badge tone="error">Inactive</Badge>}
            </SelectCard>
          ))}
        </div>
        <AuthLinkRow><AuthLink href="/login">Back to sign-in</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthCenter>
  );
}
