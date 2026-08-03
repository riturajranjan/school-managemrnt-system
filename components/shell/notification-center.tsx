"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { notificationCategories } from "./notification-data";
import { useShell } from "./shell-context";

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
                <Dialog.Description className="sr-only">
                  Notifications grouped by action required, attendance, fees, academics, transport, communication,
                  and system.
                </Dialog.Description>

                <div className="flex-1 overflow-y-auto px-sm py-sm">
                  {notificationCategories.map((category) => {
                    const items = notifications.filter((n) => n.category === category.key);
                    return (
                      <div key={category.key} className="mb-md last:mb-0">
                        <div className="flex items-center gap-xs px-sm pb-xs">
                          <category.icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {category.label}
                          </p>
                        </div>
                        {items.length === 0 ? (
                          <p className="px-sm py-xs text-sm text-muted-foreground/70">No new updates</p>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {items.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => markNotificationRead(item.id)}
                                className="flex items-start gap-sm rounded-md px-sm py-xs text-left outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <span
                                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-primary"}`}
                                  aria-hidden="true"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-baseline justify-between gap-sm">
                                    <span
                                      className={`truncate text-sm ${item.read ? "font-normal text-foreground/80" : "font-medium text-foreground"}`}
                                    >
                                      {item.title}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">{item.time}</span>
                                  </span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {item.description}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
