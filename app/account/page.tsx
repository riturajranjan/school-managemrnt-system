"use client";

// Account Settings — personal account preferences only (avatar dropdown →
// "Account Settings"). Deliberately separate from /settings, which is the
// school-administration configuration hub (RBAC-gated, org-wide). Nothing
// here can change school-level configuration.
//
// Real, wired: Change Password (POST /api/me/password), Active Sessions
// (GET/DELETE /api/me/sessions), Appearance (next-themes, already real
// app-wide). Notifications/Language & Region are shown honestly: there is no
// per-user notification-channel preference or personal locale override
// anywhere in this system yet, so those sections say so instead of
// persisting a toggle that does nothing.
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useTheme } from "next-themes";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Bell, CheckCircle2, Globe, KeyRound, Laptop, Mail, Monitor, MonitorSmartphone, Moon, ShieldCheck, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { changePasswordRequest, revokeSessionRequest, useMyProfile, useMySessions } from "@/lib/hooks/api/use-account";
import { cn, formatDateTime } from "@/lib/utils";

function useMounted() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}

function SectionCard({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-md">
      <div className="mb-sm flex items-center gap-1.5">
        <Icon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <p className="mb-sm text-xs text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

function ChangePasswordDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
  }

  async function submit() {
    setError(null);
    if (newPassword !== confirmPassword) return setError("New passwords don't match.");
    setSaving(true);
    const res = await changePasswordRequest({ currentPassword, newPassword });
    setSaving(false);
    if (!res.success) return setError(res.error.message);
    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <DetailDrawer
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
      title="Change password"
      description="You'll stay signed in on this device."
    >
      {success ? (
        <div className="flex flex-col items-center gap-sm py-lg text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="text-sm font-medium text-foreground">Password changed</p>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="current-password">Current password</Label>
            <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">At least 8 characters, with a letter and a number.</p>
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {error && (
            <p className="flex items-center gap-1.5 rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">
              <AlertTriangle className="size-3.5 shrink-0" /> {error}
            </p>
          )}
          <Button disabled={saving || !currentPassword || !newPassword} onClick={submit}>
            Update password
          </Button>
        </div>
      )}
    </DetailDrawer>
  );
}

function ActiveSessions() {
  const { data: sessions, loading, reload } = useMySessions();

  return (
    <div className="flex flex-col gap-xs">
      {(sessions ?? []).map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-muted-foreground">
              <MonitorSmartphone className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate font-medium text-foreground">
                Signed in {formatDateTime(s.createdAt)}
                {s.isCurrent && <Badge tone="success">This device</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">Expires {formatDateTime(s.expiresAt)}</p>
            </div>
          </div>
          {!s.isCurrent && (
            <Button size="sm" variant="ghost" onClick={() => revokeSessionRequest(s.id).then(reload)}>
              Sign out
            </Button>
          )}
        </div>
      ))}
      {!loading && (sessions ?? []).length === 0 && <p className="text-sm text-muted-foreground">No active sessions.</p>}
    </div>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const options: { value: string; label: string; icon: LucideIcon }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <div className="grid grid-cols-3 gap-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setTheme(o.value)}
          disabled={!mounted}
          className={cn(
            "flex flex-col items-center gap-1 rounded-md border px-sm py-sm text-xs font-medium transition-colors",
            mounted && theme === o.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
          )}
        >
          <o.icon className="size-4" />
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function AccountSettingsPage() {
  const { data: profile } = useMyProfile();
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Account Settings</h1>
        <p className="text-xs text-muted-foreground">Manage your own sign-in, notifications and display preferences.</p>
      </div>

      <SectionCard icon={ShieldCheck} title="Account & Security" description="Keep your account secure.">
        <div className="flex flex-col gap-xs">
          <div className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <KeyRound className="size-4 shrink-0 text-muted-foreground" /> Password
            </div>
            <Button size="sm" variant="outline" onClick={() => setPasswordOpen(true)}>
              Change password
            </Button>
          </div>
          <div className="rounded-md border border-border p-sm">
            <p className="mb-sm flex items-center gap-2 text-sm font-medium text-foreground">
              <Laptop className="size-4 shrink-0 text-muted-foreground" /> Active sessions
            </p>
            <ActiveSessions />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Bell} title="Notifications" description="How you're notified about activity relevant to you.">
        <div className="flex flex-col gap-xs">
          <div className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <Bell className="size-4 shrink-0 text-muted-foreground" /> In-app notifications
            </div>
            <Badge tone="success">Always on</Badge>
          </div>
          <div className="flex items-center justify-between gap-sm rounded-md border border-dashed border-border p-sm text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4 shrink-0" /> Email notifications
            </div>
            <Badge tone="neutral">Not set up</Badge>
          </div>
          <p className="text-xs text-muted-foreground">This school hasn&apos;t connected an email provider yet, so notifications only appear in-app (the bell icon).</p>
        </div>
      </SectionCard>

      <SectionCard icon={Monitor} title="Appearance" description="Choose how Novyra Campus OS looks on this device.">
        <AppearanceSection />
      </SectionCard>

      <SectionCard icon={Globe} title="Language & Region" description="Set by your school — contact your administrator to change these.">
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Language</p>
            <p className="text-sm font-medium text-foreground">{profile?.schoolLocale ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Timezone</p>
            <p className="text-sm font-medium text-foreground">{profile?.schoolTimezone ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Currency</p>
            <p className="text-sm font-medium text-foreground">{profile?.schoolCurrency ?? "—"}</p>
          </div>
        </div>
      </SectionCard>

      <ChangePasswordDrawer open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
