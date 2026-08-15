"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Bell, BellOff, CalendarDays, ClipboardCheck, FileBadge, UserCheck, type LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { useShell } from "./shell-context";
import { timeAgo } from "@/lib/utils";
import type { NotificationDto, NotificationTypeDto } from "@/lib/api/contracts";

const TYPE_ICON: Record<NotificationTypeDto, LucideIcon> = {
  "lesson-plan-approved": ClipboardCheck,
  "lesson-plan-rejected": ClipboardCheck,
  "exam-scheduled": FileBadge,
  "calendar-event": CalendarDays,
  "leave-request-submitted": UserCheck,
  "leave-request-approved": UserCheck,
  "leave-request-rejected": UserCheck,
};

export function NotificationCenter() {
  const {
    notificationCenterOpen,
    setNotificationCenterOpen,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useShell();
  const reduceMotion = useReducedMotion();

  return (
    <Dialog.Root open={notificationCenterOpen} onOpenChange={setNotificationCenterOpen}>
      <AnimatePresence>
        {notificationCenterOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.15 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-y-0 right-0 z-50 flex w-96 max-w-[90vw] flex-col border-l border-border bg-surface shadow-floating"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border px-md py-sm">
                  <Dialog.Title className="text-sm font-semibold text-foreground">Notifications</Dialog.Title>
                  <div className="flex items-center gap-sm">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="rounded-md px-xs py-1 text-xs font-medium text-primary outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Mark all read
                      </button>
                    )}
                    <Dialog.Close
                      className="flex size-9 items-center justify-center rounded-pill text-muted-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Close notifications"
                    >
                      <X className="size-[18px]" aria-hidden="true" />
                    </Dialog.Close>
                  </div>
                </div>
                <Dialog.Description className="sr-only">Your recent notifications.</Dialog.Description>

                <div className="flex-1 overflow-y-auto px-sm py-sm">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center gap-xs py-2xl text-center">
                      <BellOff className="size-5 text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">No notifications yet.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {notifications.map((item: NotificationDto) => {
                        const Icon = TYPE_ICON[item.type] ?? Bell;
                        const read = Boolean(item.readAt);
                        const content = (
                          <>
                            <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span
                              className={`mt-1.5 size-1.5 shrink-0 rounded-full ${read ? "bg-transparent" : "bg-primary"}`}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-sm">
                                <span className={`truncate text-sm ${read ? "font-normal text-foreground/80" : "font-medium text-foreground"}`}>
                                  {item.title}
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">{item.body}</span>
                            </span>
                          </>
                        );
                        return item.href ? (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => {
                              markNotificationRead(item.id);
                              setNotificationCenterOpen(false);
                            }}
                            className="flex items-start gap-sm rounded-md px-sm py-xs text-left outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {content}
                          </Link>
                        ) : (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => markNotificationRead(item.id)}
                            className="flex items-start gap-sm rounded-md px-sm py-xs text-left outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {content}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
