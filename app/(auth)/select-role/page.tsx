"use client";

import { useRouter } from "next/navigation";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";
import { SelectCard, Avatar } from "@/components/auth/selectors";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";
import { DEMO_ACCOUNTS, redirectForRole } from "@/lib/types/auth";
import { roleLabels } from "@/lib/permissions/roles";

export default function SelectRolePage() {
  const router = useRouter();
  const teacher = DEMO_ACCOUNTS.find((a) => a.key === "teacher")!;
  const roles = teacher.multiRole ?? [{ role: teacher.role, label: teacher.label, schoolId: "sch-nvx" }];

  return (
    <AuthCenter>
      <AuthCard>
        <AuthHeader title="Continue as" subtitle={`You have ${roles.length} roles at Novyra Public School.`} />
        <div className="flex flex-col gap-2">
          {roles.map((r) => (
            <SelectCard key={r.role} onClick={() => router.push(redirectForRole(r.role))}>
              <Avatar text={r.label.slice(0, 2)} color="#0891b2" />
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{r.label}</span><span className="block truncate text-xs text-muted-foreground">{roleLabels[r.role]} access</span></span>
            </SelectCard>
          ))}
        </div>
        <AuthLinkRow><AuthLink href="/login">Sign in as someone else</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthCenter>
  );
}
