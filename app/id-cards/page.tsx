"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Bus, GraduationCap, Hotel, IdCard, Library, Sparkles, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { IdCard as IdCardView } from "@/components/documents/id-card";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { idCardStyleLabels, type IdCardKind, type IdCardStyle } from "@/lib/types/documents";

const HUBS: { kind: IdCardKind; href: string; label: string; icon: typeof IdCard }[] = [
  { kind: "student", href: "/id-cards/students", label: "Student", icon: GraduationCap },
  { kind: "staff", href: "/id-cards/staff", label: "Staff", icon: UserCog },
  { kind: "library", href: "/id-cards/library", label: "Library", icon: Library },
  { kind: "transport", href: "/id-cards/transport", label: "Transport", icon: Bus },
  { kind: "hostel", href: "/id-cards/hostel", label: "Hostel", icon: Hotel },
];

const styleSamples: IdCardStyle[] = ["premium-teal", "campus-modern", "classic-school", "minimal-institutional", "junior-friendly"];

export default function IdCardsHubPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();

  const counts = useMemo(() => {
    const map = {} as Record<IdCardKind, number>;
    db.idCards.forEach((c) => { map[c.kind] = (map[c.kind] ?? 0) + 1; });
    return map;
  }, [db.idCards]);
  const sampleCard = db.idCards.find((c) => c.kind === "student") ?? db.idCards[0];

  if (!can("documents.view")) return <PermissionDenied action="view ID cards" role={roleLabels[role]} backHref="/documents" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><IdCard className="size-5 text-primary" /> ID cards</h1><p className="text-xs text-muted-foreground">{db.idCards.length} cards across all types</p></div>
        {can("documents.manageIdCards") && <Button asChild size="sm"><Link href="/id-cards/generate"><Sparkles className="size-3.5" /> Generate</Link></Button>}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-5">
        {HUBS.map((h) => <Link key={h.kind} href={h.href}><StatTile label={`${h.label} cards`} value={String(counts[h.kind] ?? 0)} icon={h.icon} tone="info" /></Link>)}
      </div>

      {/* Card style gallery */}
      {sampleCard && (
        <section className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Card styles</h2>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
            {styleSamples.map((style) => (
              <div key={style} className="flex flex-col items-center gap-1">
                <IdCardView card={sampleCard} styleOverride={style} />
                <span className="text-xs text-muted-foreground">{idCardStyleLabels[style]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-xs">
        {HUBS.map((h) => <Button key={h.kind} asChild size="sm" variant="outline"><Link href={h.href}><h.icon className="size-3.5" /> {h.label}</Link></Button>)}
        <Button asChild size="sm" variant="outline"><Link href="/id-cards/templates"><IdCard className="size-3.5" /> Templates</Link></Button>
      </div>
    </div>
  );
}
