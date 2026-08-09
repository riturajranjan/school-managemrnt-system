"use client";

import { ContextSelector } from "@/components/auth/context-selector";
import { Avatar } from "@/components/auth/selectors";

type Session = { id: string; name: string; code: string; isCurrent: boolean };

export default function SelectSessionPage() {
  return (
    <ContextSelector<Session>
      title="Academic session"
      subtitle="Choose which session to work in."
      listUrl="/api/auth/context/academic-sessions"
      postUrl="/api/auth/context/academic-session"
      field="academicSessionId"
      emptyText="No academic sessions are available for the selected school."
      renderItem={(s) => (
        <>
          <Avatar text={s.name.slice(0, 2).toUpperCase()} color="#0891b2" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {s.name}
              {s.isCurrent ? " · Current" : ""}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{s.code}</span>
          </span>
        </>
      )}
    />
  );
}
