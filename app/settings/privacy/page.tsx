"use client";

import { LegalEditor } from "@/components/settings/legal-editor";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function PrivacyPage() {
  const { role } = usePermissions();
  const canView = role === "super-admin" || role === "administrator" || role === "principal";
  if (!canView) return <PermissionDenied action="manage privacy documents" role={roleLabels[role]} backHref="/settings" />;
  return <LegalEditor kinds={["privacy", "parent-consent", "student-aup", "staff-it"]} title="Privacy & consent" />;
}
