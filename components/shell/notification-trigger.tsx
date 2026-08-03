"use client";

import { Bell } from "lucide-react";
import { useShell } from "./shell-context";
import { headerIconButtonClass, mobileIconButtonClass } from "./styles";

export function NotificationTrigger({ variant = "header" }: { variant?: "header" | "mobile" }) {
  const { setNotificationCenterOpen, unreadCount } = useShell();

  return (
    <button
      type="button"
      onClick={() => setNotificationCenterOpen(true)}
      className={variant === "mobile" ? mobileIconButtonClass : headerIconButtonClass}
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
    >
      <Bell className="size-4" aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-error px-1 text-[10px] font-semibold leading-none text-error-foreground ring-2 ring-surface"
          aria-hidden="true"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
