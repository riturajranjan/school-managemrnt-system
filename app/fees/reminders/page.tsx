"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Bell, Eye, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useReminderRules } from "@/lib/hooks/use-finance";
import { createReminderRule, deleteReminderRule, previewTemplate, setReminderRuleStatus, updateReminderRule, type ReminderRuleDraft } from "@/lib/services/reminder-rule-service";
import {
  reminderChannelLabels,
  reminderTriggerLabels,
  type ReminderAudience,
  type ReminderChannel,
  type ReminderRule,
  type ReminderTrigger,
} from "@/lib/types/fees";

const triggerOptions = Object.keys(reminderTriggerLabels) as ReminderTrigger[];
const channelOptions = Object.keys(reminderChannelLabels) as ReminderChannel[];
const SAMPLE = { studentName: "Aarav Mehta", amount: "₹5,000", dueDate: "15 Sep 2026" };
const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

function blankDraft(): ReminderRuleDraft {
  return { name: "", trigger: "before-due", offsetDays: 7, channels: ["in-app"], audience: "parent", templateEn: "Dear parent, {studentName}'s fee of {amount} is due on {dueDate}.", maxReminders: 1 };
}

export default function RemindersPage() {
  const rules = useReminderRules();
  const { can } = usePermissions();
  const canManage = can("fees.remind");

  const [drawer, setDrawer] = useState<"create" | ReminderRule | null>(null);
  const [previewRule, setPreviewRule] = useState<ReminderRule | null>(null);
  const [draft, setDraft] = useState<ReminderRuleDraft>(blankDraft());

  function openEdit(rule: ReminderRule) {
    setDrawer(rule);
    setDraft({ name: rule.name, trigger: rule.trigger, offsetDays: rule.offsetDays, channels: rule.channels, audience: rule.audience, templateEn: rule.templateEn, templateHi: rule.templateHi, quietHoursStart: rule.quietHoursStart, quietHoursEnd: rule.quietHoursEnd, maxReminders: rule.maxReminders, retryIntervalHours: rule.retryIntervalHours, escalateAfterCount: rule.escalateAfterCount });
  }

  function toggleChannel(channel: ReminderChannel) {
    setDraft((prev) => ({ ...prev, channels: prev.channels.includes(channel) ? prev.channels.filter((c) => c !== channel) : [...prev.channels, channel] }));
  }

  function handleSave() {
    if (typeof drawer === "object" && drawer !== null) updateReminderRule(drawer.id, draft, ACTOR);
    else createReminderRule(draft, ACTOR);
    setDrawer(null);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Fee reminders</h1>
          <p className="text-xs text-muted-foreground">Configure when and how dues reminders go out — no messaging backend is connected, so sends are simulated</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setDraft(blankDraft());
              setDrawer("create");
            }}
          >
            <Plus className="size-3.5" />
            New rule
          </Button>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
            <Bell className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">No reminder rules configured yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
          {rules.map((rule) => (
            <div key={rule.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {reminderTriggerLabels[rule.trigger]}
                    {rule.offsetDays !== undefined && ` · ${rule.offsetDays}d`} · {rule.audience}
                  </p>
                </div>
                <Badge tone={rule.status === "active" ? "success" : "neutral"}>{rule.status}</Badge>
              </div>

              <div className="flex flex-wrap gap-1">
                {rule.channels.map((c) => (
                  <Badge key={c} tone="info">
                    {reminderChannelLabels[c]}
                  </Badge>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-sm text-xs">
                <div>
                  <p className="text-muted-foreground">Max reminders</p>
                  <p className="font-medium text-foreground">{rule.maxReminders}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Quiet hours</p>
                  <p className="font-medium text-foreground">{rule.quietHoursStart && rule.quietHoursEnd ? `${rule.quietHoursStart}–${rule.quietHoursEnd}` : "None"}</p>
                </div>
              </div>

              {canManage && (
                <div className="flex flex-wrap items-center gap-xs border-t border-border pt-sm">
                  <Button size="sm" variant="outline" onClick={() => setPreviewRule(rule)}>
                    <Eye className="size-3.5" />
                    Preview
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(rule)}>
                    Edit
                  </Button>
                  {rule.status === "active" ? (
                    <Button size="sm" variant="outline" onClick={() => setReminderRuleStatus(rule.id, "inactive", ACTOR)}>
                      <Archive className="size-3.5" />
                      Deactivate
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setReminderRuleStatus(rule.id, "active", ACTOR)}>
                      <ArchiveRestore className="size-3.5" />
                      Activate
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-error" onClick={() => deleteReminderRule(rule.id, ACTOR)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <DetailDrawer open={drawer !== null} onOpenChange={(open) => !open && setDrawer(null)} title={typeof drawer === "object" && drawer !== null ? "Edit reminder rule" : "New reminder rule"} description="Preview the message before activating">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="rule-name">Rule name</Label>
            <Input id="rule-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label>Trigger</Label>
              <Select value={draft.trigger} onValueChange={(v) => setDraft((d) => ({ ...d, trigger: v as ReminderTrigger }))}>
                <SelectTrigger aria-label="Trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {reminderTriggerLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="offset-days">Offset (days)</Label>
              <Input id="offset-days" type="number" value={draft.offsetDays ?? 0} onChange={(e) => setDraft((d) => ({ ...d, offsetDays: Number(e.target.value) }))} />
            </div>
          </div>
          <div>
            <Label>Audience</Label>
            <Select value={draft.audience} onValueChange={(v) => setDraft((d) => ({ ...d, audience: v as ReminderAudience }))}>
              <SelectTrigger aria-label="Audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">Parent</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Channels</Label>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {channelOptions.map((c) => (
                <label key={c} className="flex min-h-9 items-center gap-1.5 text-sm text-foreground">
                  <Checkbox checked={draft.channels.includes(c)} onCheckedChange={() => toggleChannel(c)} />
                  {reminderChannelLabels[c]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="template-en">Template (English)</Label>
            <Textarea id="template-en" rows={3} value={draft.templateEn} onChange={(e) => setDraft((d) => ({ ...d, templateEn: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="template-hi">Template (Hindi, optional)</Label>
            <Textarea id="template-hi" rows={3} value={draft.templateHi ?? ""} onChange={(e) => setDraft((d) => ({ ...d, templateHi: e.target.value || undefined }))} />
          </div>
          <div className="rounded-md border border-dashed border-border p-sm text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Preview (sample data)</p>
            <p>{previewTemplate(draft.templateEn, SAMPLE)}</p>
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="max-reminders">Max reminders</Label>
              <Input id="max-reminders" type="number" min={1} value={draft.maxReminders} onChange={(e) => setDraft((d) => ({ ...d, maxReminders: Number(e.target.value) }))} />
            </div>
            <div>
              <Label htmlFor="retry-hours">Retry interval (hours)</Label>
              <Input id="retry-hours" type="number" min={0} value={draft.retryIntervalHours ?? ""} onChange={(e) => setDraft((d) => ({ ...d, retryIntervalHours: e.target.value === "" ? undefined : Number(e.target.value) }))} />
            </div>
            <div>
              <Label htmlFor="quiet-start">Quiet hours start</Label>
              <Input id="quiet-start" type="time" value={draft.quietHoursStart ?? ""} onChange={(e) => setDraft((d) => ({ ...d, quietHoursStart: e.target.value || undefined }))} />
            </div>
            <div>
              <Label htmlFor="quiet-end">Quiet hours end</Label>
              <Input id="quiet-end" type="time" value={draft.quietHoursEnd ?? ""} onChange={(e) => setDraft((d) => ({ ...d, quietHoursEnd: e.target.value || undefined }))} />
            </div>
          </div>
          <Button disabled={!draft.name.trim() || draft.channels.length === 0} onClick={handleSave}>
            Save rule
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={previewRule !== null} onOpenChange={(open) => !open && setPreviewRule(null)} title="Message preview" description={previewRule?.name}>
        {previewRule && (
          <div className="flex flex-col gap-sm">
            <div className="rounded-md border border-border p-sm text-sm">
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">English</p>
              <p className="text-foreground">{previewTemplate(previewRule.templateEn, SAMPLE)}</p>
            </div>
            {previewRule.templateHi && (
              <div className="rounded-md border border-border p-sm text-sm">
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">हिन्दी</p>
                <p className="text-foreground">{previewTemplate(previewRule.templateHi, SAMPLE)}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Rendered with sample data — no message is actually sent from this preview.</p>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
