"use client";

import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";
import { SelectCard, Avatar } from "@/components/auth/selectors";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";
import { MOCK_BRANCHES } from "@/lib/types/auth";

export default function SelectBranchPage() {
  const router = useRouter();
  return (
    <AuthCenter>
      <AuthCard>
        <AuthHeader title="Choose a branch" subtitle="Novyra Public School · select where to work." />
        <div className="flex flex-col gap-2">
          {MOCK_BRANCHES.map((b) => (
            <SelectCard key={b.id} onClick={() => router.push("/select-session")}>
              <Avatar text={b.name.slice(0, 2)} color="#022c43" />
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{b.name}</span><span className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3" /> {b.city} · {b.role}</span></span>
            </SelectCard>
          ))}
        </div>
        <AuthLinkRow><AuthLink href="/select-school">Change school</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthCenter>
  );
}
