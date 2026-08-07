"use client";

import Link from "next/link";
import { useMemo } from "react";
import { GraduationCap, ScrollText, Sparkles, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";

export default function LettersHubPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const staffLetters = useMemo(() => db.generatedDocuments.filter((d) => d.kind === "letter" && d.recipient.type === "staff").length, [db.generatedDocuments]);

  if (!can("documents.view")) return <PermissionDenied action="view letters" role={roleLabels[role]} backHref="/documents" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><ScrollText className="size-5 text-primary" /> Letters</h1><p className="text-xs text-muted-foreground">Offer, appointment, experience, relieving, salary and more</p></div>
        {can("documents.generate") && <Button asChild size="sm"><Link href="/documents/generate"><Sparkles className="size-3.5" /> Generate</Link></Button>}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <Link href="/letters/staff"><StatTile label="Staff letters" value={String(staffLetters)} icon={UserCog} tone="info" /></Link>
        <Link href="/letters/student"><StatTile label="Student letters" value="0" icon={GraduationCap} tone="neutral" hint="Recommendation & custom" /></Link>
      </div>

      <div className="flex flex-wrap gap-xs">
        <Button asChild size="sm" variant="outline"><Link href="/letters/staff"><UserCog className="size-3.5" /> Staff letters</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href="/letters/student"><GraduationCap className="size-3.5" /> Student letters</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href="/letters/templates"><ScrollText className="size-3.5" /> Templates</Link></Button>
      </div>
      <p className="rounded-md border border-primary/25 bg-primary/5 p-sm text-xs text-primary">Letter previews render on a white print page even in dark mode — documents are never auto-inverted.</p>
    </div>
  );
}
