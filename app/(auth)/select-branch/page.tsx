"use client";

import { ContextSelector } from "@/components/auth/context-selector";
import { Avatar } from "@/components/auth/selectors";

type Branch = { id: string; name: string; code: string; isPrimary: boolean };

export default function SelectBranchPage() {
  return (
    <ContextSelector<Branch>
      title="Choose a branch"
      subtitle="Select where you want to work."
      listUrl="/api/auth/context/branches"
      postUrl="/api/auth/context/branch"
      field="branchId"
      emptyText="No branches are available for the selected school."
      renderItem={(b) => (
        <>
          <Avatar text={b.name.slice(0, 2).toUpperCase()} color="#022c43" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {b.name}
              {b.isPrimary ? " · Primary" : ""}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{b.code}</span>
          </span>
        </>
      )}
    />
  );
}
