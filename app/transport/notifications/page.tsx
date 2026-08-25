"use client";

import { useState } from "react";
import { Bell, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportNotifications, useCurrentTransportStaff, sendTransportNotificationRequest } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/utils";

export default function TransportNotificationsPage() {
  const { data, loading, error, reload } = useTransportNotifications();
  const { data: drivers } = useCurrentTransportStaff("driver");
  const { data: attendants } = useCurrentTransportStaff("attendant");
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const notifications = data?.notifications ?? [];
  const recipientOptions = [...new Map([...(drivers ?? []), ...(attendants ?? [])].map((a) => [a.staffId, a.staffName])).entries()];

  const [sendOpen, setSendOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view transport notifications" role={roleLabels[role]} backHref="/transport" />;
  }
  const canManage = hasServerPermission("transport.manage");

  function toggleStaff(id: string) {
    setSelectedStaffIds((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));
  }

  async function submit() {
    setBusy(true);
    setFormError(null);
    const result = await sendTransportNotificationRequest({ title: title.trim(), body: body.trim(), recipientStaffIds: selectedStaffIds });
    setBusy(false);
    if (!result.success) {
      setFormError(result.error.message);
      return;
    }
    setSendOpen(false);
    setTitle("");
    setBody("");
    setSelectedStaffIds([]);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Transport notifications</h1>
          <p className="text-xs text-muted-foreground">In-app alerts to drivers and attendants — no SMS/WhatsApp, no parent channel (no linked guardian account exists yet)</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setSendOpen(true)}>
            <Plus className="size-3.5" />
            Send notification
          </Button>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load notifications: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading notifications…</div>
      ) : (
        <ul className="flex flex-col gap-sm">
          {notifications.map((n) => (
            <li key={n.id} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-md">
              <div className="flex items-center justify-between gap-sm">
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                <Badge tone="neutral">
                  {n.readCount}/{n.recipientCount} read
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{n.body}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
            </li>
          ))}
          {notifications.length === 0 && (
            <li className="flex flex-col items-center gap-xs rounded-lg border border-dashed border-border p-lg text-center">
              <Bell className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No transport notifications sent yet.</p>
            </li>
          )}
        </ul>
      )}

      <DetailDrawer open={sendOpen} onOpenChange={setSendOpen} title="Send notification" description="Delivered in-app to selected drivers/attendants with a linked account">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="notif-title">Title</Label>
            <Input id="notif-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="notif-body">Message</Label>
            <Textarea id="notif-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Recipients</Label>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border p-sm">
              {recipientOptions.map(([id, name]) => (
                <div key={id} className="flex items-center gap-xs">
                  <Checkbox id={`recipient-${id}`} checked={selectedStaffIds.includes(id)} onCheckedChange={() => toggleStaff(id)} />
                  <Label htmlFor={`recipient-${id}`} className="font-normal">
                    {name}
                  </Label>
                </div>
              ))}
              {recipientOptions.length === 0 && <p className="text-xs text-muted-foreground">No drivers or attendants currently on duty to notify.</p>}
            </div>
          </div>
          {formError && <p className="text-xs text-error">{formError}</p>}
          <Button disabled={!title.trim() || !body.trim() || selectedStaffIds.length === 0 || busy} onClick={submit}>
            Send
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
