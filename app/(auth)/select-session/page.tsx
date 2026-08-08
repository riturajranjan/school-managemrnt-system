"use client";

import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";
import { SelectCard } from "@/components/auth/selectors";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";
import { MOCK_SESSIONS } from "@/lib/types/auth";

const stateTone = { current: "success", previous: "neutral", upcoming: "info" } as const;
const stateLabel = { current: "Current", previous: "Read-only", upcoming: "Upcoming" } as const;

export default function SelectSessionPage() {
  const router = useRouter();
  return (
    <AuthCenter>
      <AuthCard>
        <AuthHeader title="Academic session" subtitle="Choose which session to work in." />
        <div className="flex flex-col gap-2">
          {MOCK_SESSIONS.map((s) => (
            <SelectCard key={s.id} onClick={() => router.push("/")}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: s.state === "current" ? "#16a34a" : "#64748b" }}><CalendarRange className="size-4" /></span>
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{s.name}</span>{s.state === "previous" && <span className="block text-xs text-muted-foreground">Historical · read-only context</span>}</span>
              <Badge tone={stateTone[s.state]} className="ml-auto mr-1">{stateLabel[s.state]}</Badge>
            </SelectCard>
          ))}
        </div>
        <AuthLinkRow><AuthLink href="/select-branch">Change branch</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthCenter>
  );
}
