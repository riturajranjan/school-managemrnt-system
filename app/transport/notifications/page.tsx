"use client";

import { useState } from "react";
import { Bell, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  useTransportNotificationRules,
  useTransportNotifications,
} from "@/lib/hooks/use-transport";
import {
  createNotificationRule,
  previewNotificationTemplate,
  setNotificationRuleStatus,
} from "@/lib/services/transport-notification-service";
import {
  transportNotificationAudienceLabels,
  transportNotificationChannelLabels,
  transportNotificationTriggerLabels,
  type TransportNotificationAudience,
  type TransportNotificationChannel,
  type TransportNotificationRule,
  type TransportNotificationTrigger,
} from "@/lib/types/transport";
import { formatDateTime } from "@/lib/utils";

const ACTOR = {
  name: "Transport Administrator",
  role: "Transport Administrator",
};
const triggerOptions = Object.keys(
  transportNotificationTriggerLabels,
) as TransportNotificationTrigger[];
const channelOptions = Object.keys(
  transportNotificationChannelLabels,
) as TransportNotificationChannel[];
const audienceOptions = Object.keys(
  transportNotificationAudienceLabels,
) as TransportNotificationAudience[];
const SAMPLE = {
  studentName: "Aarav Mehta",
  routeName: "Route 1 — Indiranagar Corridor",
  stopName: "Indiranagar 100ft Road",
  delayMinutes: "12",
};

export default function TransportNotificationsPage() {
  const rules = useTransportNotificationRules();
  const notifications = useTransportNotifications();
  const { can } = usePermissions();
  const canManage = can("transport.manageNotifications");

  const [tab, setTab] = useState<"rules" | "log">("rules");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<TransportNotificationTrigger>("delay");
  const [channels, setChannels] = useState<TransportNotificationChannel[]>([
    "push",
  ]);
  const [audience, setAudience] =
    useState<TransportNotificationAudience>("parent");
  const [templateEn, setTemplateEn] = useState("");
  const [templateHi, setTemplateHi] = useState("");

  function toggleChannel(channel: TransportNotificationChannel) {
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((c) => c !== channel)
        : [...current, channel],
    );
  }

  const ruleColumns: ColumnDef<TransportNotificationRule>[] = [
    {
      id: "name",
      header: "Rule",
      alwaysVisible: true,
      sortValue: (r) => r.name,
      cell: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{r.name}</p>
          <p className="text-xs text-muted-foreground">
            {transportNotificationTriggerLabels[r.trigger]}
          </p>
        </div>
      ),
    },
    {
      id: "channels",
      header: "Channels",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.channels
            .map((c) => transportNotificationChannelLabels[c])
            .join(", ")}
        </span>
      ),
    },
    {
      id: "audience",
      header: "Audience",
      cell: (r) => (
        <Badge tone="info">
          {transportNotificationAudienceLabels[r.audience]}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (r) => (
        <Badge tone={r.status === "active" ? "success" : "neutral"}>
          {r.status === "active" ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  const ruleActions: RowAction<TransportNotificationRule>[] = canManage
    ? [
        {
          key: "deactivate",
          label: "Deactivate",
          hidden: (r) => r.status !== "active",
          onSelect: (r) => setNotificationRuleStatus(r.id, "inactive", ACTOR),
        },
        {
          key: "activate",
          label: "Activate",
          hidden: (r) => r.status !== "inactive",
          onSelect: (r) => setNotificationRuleStatus(r.id, "active", ACTOR),
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Notifications
          </h1>
          <p className="text-xs text-muted-foreground">
            Parent alerts and communication rules
          </p>
        </div>
        {canManage && tab === "rules" && (
          <Button
            size="sm"
            onClick={() => {
              setName("");
              setTemplateEn("");
              setTemplateHi("");
              setChannels(["push"]);
              setCreateOpen(true);
            }}>
            <Plus className="size-3.5" />
            New rule
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1 rounded-md bg-surface-secondary p-1">
        {(["rules", "log"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-8 flex-1 rounded-md px-sm text-xs font-medium capitalize transition-colors ${tab === t ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}>
            {t === "rules" ? "Rules" : "Sent log"}
          </button>
        ))}
      </div>

      {tab === "rules" ? (
        <DataTable
          columns={ruleColumns}
          rows={rules}
          getRowId={(r) => r.id}
          caption="Notification rules"
          rowActions={ruleActions}
          renderMobileCard={(r) => (
            <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">
                  {r.name}
                </p>
                <Badge tone={r.status === "active" ? "success" : "neutral"}>
                  {r.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {transportNotificationTriggerLabels[r.trigger]} ·{" "}
                {r.channels
                  .map((c) => transportNotificationChannelLabels[c])
                  .join(", ")}
              </p>
            </div>
          )}
          emptyIcon={Bell}
          emptyTitle="No notification rules configured"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="p-xs text-left">Trigger</th>
                <th className="p-xs text-left">Channel</th>
                <th className="p-xs text-left">Message</th>
                <th className="p-xs text-right">Sent</th>
              </tr>
            </thead>
            <tbody>
              {[...notifications]
                .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))
                .map((n) => (
                  <tr key={n.id} className="border-t border-border">
                    <td className="p-xs text-foreground">
                      {transportNotificationTriggerLabels[n.trigger]}
                    </td>
                    <td className="p-xs text-muted-foreground">
                      {transportNotificationChannelLabels[n.channel]}
                    </td>
                    <td className="p-xs  truncate text-foreground">
                      {n.message}
                    </td>
                    <td className="p-xs text-right text-muted-foreground">
                      {formatDateTime(n.sentAt)}
                    </td>
                  </tr>
                ))}
              {notifications.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-md text-center text-muted-foreground">
                    No notifications sent yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <DetailDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New notification rule"
        description="Preview the message before it can be activated">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="rule-name">Rule name</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>Trigger</Label>
            <Select
              value={trigger}
              onValueChange={(v) =>
                setTrigger(v as TransportNotificationTrigger)
              }>
              <SelectTrigger aria-label="Trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {triggerOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {transportNotificationTriggerLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Audience</Label>
            <Select
              value={audience}
              onValueChange={(v) =>
                setAudience(v as TransportNotificationAudience)
              }>
              <SelectTrigger aria-label="Audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {audienceOptions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {transportNotificationAudienceLabels[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Channels</Label>
            <div className="flex flex-wrap gap-sm">
              {channelOptions.map((c) => (
                <label
                  key={c}
                  className="flex items-center gap-1.5 text-xs text-foreground">
                  <Checkbox
                    checked={channels.includes(c)}
                    onCheckedChange={() => toggleChannel(c)}
                  />
                  {transportNotificationChannelLabels[c]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="template-en">Template (English)</Label>
            <Textarea
              id="template-en"
              value={templateEn}
              onChange={(e) => setTemplateEn(e.target.value)}
              rows={2}
              placeholder="{studentName} boarded at {stopName}."
            />
          </div>
          <div>
            <Label htmlFor="template-hi">Template (Hindi, optional)</Label>
            <Textarea
              id="template-hi"
              value={templateHi}
              onChange={(e) => setTemplateHi(e.target.value)}
              rows={2}
            />
          </div>
          {templateEn.trim() && (
            <div className="rounded-md border border-border bg-surface-secondary p-sm">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Preview
              </p>
              <p className="text-sm text-foreground">
                {previewNotificationTemplate(templateEn, SAMPLE)}
              </p>
            </div>
          )}
          <Button
            disabled={
              !name.trim() || !templateEn.trim() || channels.length === 0
            }
            onClick={() => {
              createNotificationRule(
                {
                  name: name.trim(),
                  trigger,
                  channels,
                  audience,
                  templateEn: templateEn.trim(),
                  templateHi: templateHi.trim() || undefined,
                },
                ACTOR,
              );
              setCreateOpen(false);
            }}>
            Create rule
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
