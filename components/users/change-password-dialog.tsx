"use client";

// Real password-change modal (User & Access UX pass) — replaces the old
// "Reset Password" list action that generated a setup link. Two clearly
// distinct, honestly-labeled flows:
//   - Self (viewing your own account): requires your real current password.
//   - Administrator reset (viewing someone else's account): sets a new
//     password directly, labeled as an administrator action, never
//     pretending to be a normal self-service change — the server enforces
//     this same boundary (adminSetPassword rejects a self-target outright).
// Never generates or displays a setup/reset link.
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { KeyRound, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PasswordInput, PasswordStrengthMeter, passwordStrength } from "@/components/ui/password-input";
import { useAdminSetPassword, useChangeOwnPassword } from "@/lib/hooks/api/use-users-api";

export function ChangePasswordDialog({
  open,
  onOpenChange,
  userId,
  userName,
  isSelf,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  isSelf: boolean;
  onSuccess?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const changeOwn = useChangeOwnPassword();
  const adminSet = useAdminSetPassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forceChange, setForceChange] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const loading = changeOwn.loading || adminSet.loading;
  const error = localError ?? changeOwn.error ?? adminSet.error;
  const strength = passwordStrength(newPassword);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setForceChange(false);
    setLocalError(null);
    changeOwn.reset();
    adminSet.reset();
  }

  async function submit() {
    setLocalError(null);
    if (!strength.meetsPolicy) return setLocalError("Password must be at least 8 characters and include a letter and a number.");
    if (newPassword !== confirmPassword) return setLocalError("Passwords do not match.");
    if (isSelf && !currentPassword) return setLocalError("Enter your current password.");

    const res = isSelf
      ? await changeOwn.run({ currentPassword, newPassword })
      : await adminSet.run(userId, { newPassword, forcePasswordChange: forceChange });

    if (res.success) {
      reset();
      onOpenChange(false);
      onSuccess?.();
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div className="fixed inset-0 z-50 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.15 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] w-full flex-col gap-md overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-md shadow-floating sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(100%,theme(spacing.96))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
              >
                <div className="flex items-start gap-sm">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-primary/10 text-primary">
                    <KeyRound className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <Dialog.Title className="text-sm font-semibold text-foreground">Change Password</Dialog.Title>
                    <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                      {isSelf ? "Update your own account password." : `Set a new password for ${userName}.`}
                    </Dialog.Description>
                  </div>
                </div>

                {!isSelf && (
                  <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-sm text-xs text-warning">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>Administrator reset — this sets a new password directly. {userName} is not asked for their old one.</span>
                  </div>
                )}

                <div className="flex flex-col gap-sm">
                  {isSelf && (
                    <div>
                      <Label htmlFor="cp-current">Current Password</Label>
                      <PasswordInput id="cp-current" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="cp-new">New Password *</Label>
                    <PasswordInput id="cp-new" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    <PasswordStrengthMeter value={newPassword} />
                  </div>
                  <div>
                    <Label htmlFor="cp-confirm">Confirm New Password *</Label>
                    <PasswordInput id="cp-confirm" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                    {mismatch && <p className="mt-1 text-xs text-destructive">Passwords do not match.</p>}
                  </div>
                  {!isSelf && (
                    <label className="flex items-center gap-2 text-xs text-foreground">
                      <Checkbox checked={forceChange} onCheckedChange={(v) => setForceChange(v === true)} />
                      Force password change on next login
                    </label>
                  )}
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}

                <div className="flex justify-end gap-sm">
                  <Dialog.Close asChild>
                    <Button variant="outline">Cancel</Button>
                  </Dialog.Close>
                  <Button disabled={loading} onClick={submit}>{loading ? "Saving…" : "Change Password"}</Button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
