"use client";

import { ContextSelector } from "@/components/auth/context-selector";
import { Avatar } from "@/components/auth/selectors";

type School = { id: string; name: string; code: string };

export default function SelectSchoolPage() {
  return (
    <ContextSelector<School>
      title="Choose a school"
      subtitle="Select the school you want to work in."
      listUrl="/api/auth/context/schools"
      postUrl="/api/auth/context/school"
      field="schoolId"
      emptyText="No schools are available for your account."
      renderItem={(s) => (
        <>
          <Avatar text={s.name.slice(0, 2).toUpperCase()} color="#022c43" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{s.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{s.code}</span>
          </span>
        </>
      )}
    />
  );
}
