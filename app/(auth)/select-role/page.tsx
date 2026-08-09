"use client";

import { ContextSelector } from "@/components/auth/context-selector";
import { Avatar } from "@/components/auth/selectors";

type Role = { id: string; key: string; name: string };

export default function SelectRolePage() {
  return (
    <ContextSelector<Role>
      title="Continue as"
      subtitle="Choose the role you want to use."
      listUrl="/api/auth/context/roles"
      postUrl="/api/auth/context/role"
      field="roleId"
      emptyText="No roles are assigned to your account."
      renderItem={(r) => (
        <>
          <Avatar text={r.name.slice(0, 2).toUpperCase()} color="#7c3aed" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{r.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{r.key}</span>
          </span>
        </>
      )}
    />
  );
}
