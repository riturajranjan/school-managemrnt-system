"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CertificatePreview } from "@/components/activities/certificate-preview";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function AwardCeremonyPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  // Ceremony reel — issued certificates paired with their template.
  const reel = useMemo(() => db.certificates.filter((c) => c.status === "issued").map((c) => ({ certificate: c, template: db.certificateTemplates.find((t) => t.id === c.templateId) })).filter((r) => r.template), [db.certificates, db.certificateTemplates]);

  if (!can("activities.view")) return <PermissionDenied action="view the ceremony" role={roleLabels[role]} backHref="/activities/certificates" />;

  const current = reel[index];
  const prev = () => setIndex((i) => (i - 1 + reel.length) % reel.length);
  const next = () => setIndex((i) => (i + 1) % reel.length);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/certificates"><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Sparkles className="size-5 text-primary" /> Award ceremony mode</h1><p className="text-xs text-muted-foreground">Present certificates one by one{reduceMotion ? " · reduced motion on" : ""}</p></div>
      </div>

      {reel.length === 0 || !current?.template ? (
        <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No issued certificates to present. Issue some from the <Link href="/activities/certificates" className="text-primary">builder</Link>.</div>
      ) : (
        <div className="flex flex-col items-center gap-md">
          <p className="text-xs text-muted-foreground">{index + 1} of {reel.length}</p>
          <div className="w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.certificate.id}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 16 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -12 }}
                transition={{ duration: reduceMotion ? 0.15 : 0.5, ease: "easeOut" }}
              >
                <CertificatePreview data={{ template: current.template, recipientName: current.certificate.recipientName, eventTitle: current.certificate.eventTitle, position: current.certificate.position, issuedDate: formatDate(current.certificate.issuedDate), serial: current.certificate.serial }} />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-sm">
            <Button size="sm" variant="outline" onClick={prev}><ChevronLeft className="size-4" /> Previous</Button>
            <Button size="sm" onClick={next}>Next <ChevronRight className="size-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
