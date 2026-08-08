"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useIntegrations } from "@/lib/hooks/use-admin";
import { roleLabels } from "@/lib/permissions/roles";
import { integrationCategoryLabels } from "@/lib/types/admin";

export default function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ integrationId: string }>;
}) {
  const { integrationId } = use(params);
  const { role } = usePermissions();
  const integration = useIntegrations().find((i) => i.id === integrationId);
  const [tested, setTested] = useState(false);

  const canView = role === "super-admin" || role === "administrator";
  if (!canView)
    return (
      <PermissionDenied
        action="view this integration"
        role={roleLabels[role]}
        backHref="/settings/integrations"
      />
    );
  if (!integration)
    return (
      <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
        Integration not found.{" "}
        <Link href="/settings/integrations" className="text-primary">
          Back
        </Link>
      </div>
    );

  return (
    <div className="mx-auto flex  flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/settings/integrations">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-surface-secondary text-lg font-bold text-foreground">
            {integration.logoGlyph}
          </span>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {integration.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              {integrationCategoryLabels[integration.category]}
            </p>
          </div>
        </div>
      </div>

      <Badge
        tone={
          integration.status === "demo-placeholder" ? "warning" : "neutral"
        }>
        {integration.status === "demo-placeholder"
          ? "Demo placeholder"
          : "Not connected"}
      </Badge>

      <div className="rounded-lg border border-border bg-surface p-md text-sm">
        <p className="text-muted-foreground">{integration.description}</p>
        <div className="mt-sm grid grid-cols-1 gap-md sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold text-foreground">
              Capabilities
            </p>
            <ul className="space-y-0.5">
              {integration.capabilities.map((c) => (
                <li
                  key={c}
                  className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3 text-success" /> {c}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-foreground">
              Required setup
            </p>
            <ul className="space-y-0.5">
              {integration.requiredSetup.map((c) => (
                <li key={c} className="text-xs text-muted-foreground">
                  • {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-primary/25 bg-primary/5 p-sm text-xs text-primary flex items-start gap-2">
        <Info className="mt-0.5 size-3.5 shrink-0" /> This is a UI placeholder.
        No API keys or secrets are collected here, and connecting requires
        backend implementation.
      </div>

      <div className="flex gap-xs">
        <Button size="sm" variant="outline" onClick={() => setTested(true)}>
          Test configuration (simulation)
        </Button>
        <Button size="sm" disabled title="Connect requires backend">
          Connect
        </Button>
      </div>
      {tested && (
        <p className="text-xs text-muted-foreground">
          Simulated test complete — a real connection needs backend credentials
          and a webhook endpoint.
        </p>
      )}
    </div>
  );
}
