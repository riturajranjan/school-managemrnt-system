"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";
import { SelectCard, Avatar } from "@/components/auth/selectors";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";
import { DEMO_ACCOUNTS } from "@/lib/types/auth";

const attTone = { present: "success", absent: "error", "not-marked": "neutral" } as const;
const attLabel = { present: "Present today", absent: "Absent today", "not-marked": "Not marked" } as const;

export default function SelectChildPage() {
  const router = useRouter();
  const parent = DEMO_ACCOUNTS.find((a) => a.key === "parent")!;
  const children = parent.children ?? [];

  return (
    <AuthCenter>
      <AuthCard>
        <AuthHeader title="Choose a child" subtitle="Select whose dashboard you'd like to open." />
        <div className="flex flex-col gap-2">
          {children.map((c) => (
            <SelectCard key={c.id} onClick={() => router.push("/parent/activities")}>
              <Avatar text={c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")} color={c.avatarColor} className="size-11" />
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{c.name}</span><span className="block truncate text-xs text-muted-foreground">{c.className} · {c.section} · {c.schoolName}</span></span>
              <Badge tone={attTone[c.attendanceToday]} className="ml-auto mr-1">{attLabel[c.attendanceToday]}</Badge>
            </SelectCard>
          ))}
        </div>
        <AuthLinkRow><AuthLink href="/login">Sign out</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthCenter>
  );
}
