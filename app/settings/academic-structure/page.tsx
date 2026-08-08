"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { schoolClasses } from "@/lib/data/seed/reference";
import { roleLabels } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";

export default function AcademicStructurePage() {
  const db = useSisStore();
  const { role } = usePermissions();
  const [openId, setOpenId] = useState<string | null>(schoolClasses[3]?.id ?? null);

  const subjectsByClass = useMemo(() => {
    const map = new Map<string, number>();
    db.subjects.forEach((s) => { const key = (s as { classId?: string }).classId; if (key) map.set(key, (map.get(key) ?? 0) + 1); });
    return map;
  }, [db.subjects]);

  const canView = role === "super-admin" || role === "administrator" || role === "principal" || role === "academic-coordinator";
  if (!canView) return <PermissionDenied action="view academic structure" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><LayoutGrid className="size-5 text-primary" /> Academic structure</h1><p className="text-xs text-muted-foreground">Board → Session → Class → Section → Subjects (configuration overview)</p></div>

      {/* Hierarchy breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-sm text-sm">
        {["CBSE", "2026-2027", "Classes", "Sections", "Subjects"].map((n, i, arr) => (
          <span key={n} className="flex items-center gap-1"><span className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs font-medium text-foreground">{n}</span>{i < arr.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}</span>
        ))}
      </div>

      <div className="flex flex-col gap-xs">
        {schoolClasses.map((c) => {
          const open = openId === c.id;
          return (
            <div key={c.id} className="rounded-lg border border-border bg-surface">
              <button type="button" onClick={() => setOpenId(open ? null : c.id)} className="flex w-full items-center justify-between gap-sm p-sm text-left">
                <div className="flex items-center gap-2"><ChevronRight className={cn("size-4 text-muted-foreground transition", open && "rotate-90")} /><span className="text-sm font-medium text-foreground">{c.name}</span></div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>{c.sections.length} sections</span><Badge tone="info">{subjectsByClass.get(c.id) ?? "—"} subjects</Badge></div>
              </button>
              {open && (
                <div className="border-t border-border p-sm">
                  <div className="grid grid-cols-1 gap-xs sm:grid-cols-2 lg:grid-cols-3">
                    {c.sections.map((s) => (
                      <div key={s.id} className="rounded-md border border-border p-sm text-sm"><div className="flex items-center justify-between"><span className="font-medium text-foreground">Section {s.name}</span><Badge tone={s.enrolledCount >= s.capacity ? "warning" : "success"}>{s.enrolledCount}/{s.capacity}</Badge></div><p className="text-xs text-muted-foreground">Teacher: {s.classTeacher}</p></div>
                    ))}
                  </div>
                  <p className="mt-sm text-xs text-muted-foreground">Manage classes & subjects in <Link href="/academics/classes" className="text-primary">Academics → Classes</Link>. This page is an overview only.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
