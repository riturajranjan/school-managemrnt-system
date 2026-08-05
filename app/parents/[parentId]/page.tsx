"use client";

import Link from "next/link";
import { use } from "react";
import { Mail, Phone, RefreshCcw, Send, ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { portalStatusLabels, portalStatusTone } from "@/components/parents/parent-meta";
import { studentStatusTone } from "@/components/students/student-meta";
import { TimelineList } from "@/components/timeline/timeline-list";
import { usePermissions } from "@/components/providers/permissions-provider";
import { findClass, findSection } from "@/lib/data/seed/reference";
import { useParentProfile } from "@/lib/hooks/use-parents";
import { resetPortalAccess, sendPortalInvite, suspendPortalAccess, updatePickupAuthorization } from "@/lib/services/parents-service";
import { studentStatusLabels } from "@/lib/types/students";
import { initialsOf } from "@/lib/utils";

export default function ParentProfilePage({ params }: { params: Promise<{ parentId: string }> }) {
  const { parentId } = use(params);
  const profile = useParentProfile(parentId);
  const { can } = usePermissions();

  if (!profile) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Parent not found</p>
        <Button asChild variant="outline">
          <Link href="/parents">Back to Parents</Link>
        </Button>
      </div>
    );
  }

  const { account, guardian, children } = profile;
  const communicationEvents = children.flatMap((c) => c.student.timeline.filter((e) => e.category === "communication"));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-start sm:justify-between sm:p-md">
        <div className="flex items-start gap-sm">
          <Avatar className="size-12">
            <AvatarFallback>{initialsOf(guardian.firstName, guardian.lastName)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-xs">
              <h1 className="text-base font-semibold text-foreground">
                {guardian.firstName} {guardian.lastName}
              </h1>
              <Badge tone={portalStatusTone[account.portalStatus]}>{portalStatusLabels[account.portalStatus]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{guardian.occupation ?? "—"}{guardian.organization ? ` · ${guardian.organization}` : ""}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-sm gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" /> {guardian.contact.phone}
              </span>
              {guardian.contact.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3" /> {guardian.contact.email}
                </span>
              )}
            </div>
          </div>
        </div>

        {can("parents.managePortal") && (
          <div className="flex flex-wrap items-center gap-xs">
            {account.portalStatus !== "active" && (
              <Button size="sm" variant="outline" onClick={() => sendPortalInvite(account.id)}>
                <Send className="size-3.5" /> Send portal invite
              </Button>
            )}
            {account.portalStatus === "active" && (
              <>
                <Button size="sm" variant="outline" onClick={() => resetPortalAccess(account.id)}>
                  <RefreshCcw className="size-3.5" /> Reset access
                </Button>
                <Button size="sm" variant="outline" className="text-error" onClick={() => suspendPortalAccess(account.id)}>
                  <ShieldOff className="size-3.5" /> Suspend
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Linked children</h2>
          <ul className="flex flex-col gap-sm">
            {children.map(({ student, link }) => (
              <li key={student.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                <Link href={`/students/${student.id}`} className="min-w-0 flex-1 hover:underline">
                  <p className="truncate text-sm font-medium text-foreground">
                    {student.profile.firstName} {student.profile.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {findClass(student.classId)?.name}-{findSection(student.sectionId)?.section.name} · {link.relationship}
                    {link.isPrimary ? " · primary" : ""}
                  </p>
                </Link>
                <Badge tone={studentStatusTone[student.status]}>{studentStatusLabels[student.status]}</Badge>
              </li>
            ))}
            {children.length === 0 && <p className="text-sm text-muted-foreground">No children linked yet.</p>}
          </ul>
          <Button variant="outline" size="sm" className="mt-sm" disabled>
            <UserPlus className="size-3.5" /> Link another child
          </Button>
        </div>

        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Authorized pickup &amp; fee responsibility</h2>
          <ul className="flex flex-col gap-sm">
            {children.map(({ student, link }) => (
              <li key={student.id} className="flex items-center justify-between gap-sm text-sm">
                <span className="text-foreground">{student.profile.firstName} {student.profile.lastName}</span>
                <div className="flex items-center gap-md">
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Checkbox
                      checked={link.isAuthorizedPickup}
                      disabled={!can("parents.manage")}
                      onCheckedChange={(checked) => updatePickupAuthorization(student.id, guardian.id, checked === true)}
                    />
                    Pickup
                  </label>
                  {link.isFeeResponsible && <Badge tone="info">Fee payer</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Consent forms</h2>
          <ul className="flex flex-col gap-sm">
            {account.consentForms.map((form) => (
              <li key={form.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{form.title}</span>
                <Badge tone={form.status === "signed" ? "success" : "warning"}>{form.status}</Badge>
              </li>
            ))}
            {account.consentForms.length === 0 && <p className="text-sm text-muted-foreground">No consent forms on file.</p>}
          </ul>
        </div>

        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-4 text-success" /> Portal login history
          </h2>
          {account.loginHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No login activity yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {account.loginHistory.map((entry) => (
                <li key={entry.id} className="flex justify-between">
                  <span>{entry.device}</span>
                  <span>{new Date(entry.at).toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border p-sm">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Activity timeline</h2>
        <TimelineList events={communicationEvents} emptyMessage="No communication recorded with this guardian yet." />
      </div>
    </div>
  );
}
