"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MOCK_BRANCHES, MOCK_SCHOOLS, MOCK_SESSIONS } from "./context-data";
import { initialNotifications, type NotificationItem } from "./notification-data";

type ShellContextValue = {
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  tabletDrawerOpen: boolean;
  setTabletDrawerOpen: (open: boolean) => void;
  mobileMoreOpen: boolean;
  setMobileMoreOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  aiCommandOpen: boolean;
  setAiCommandOpen: (open: boolean) => void;
  notificationCenterOpen: boolean;
  setNotificationCenterOpen: (open: boolean) => void;
  mobileSearchOpen: boolean;
  setMobileSearchOpen: (open: boolean) => void;
  mobileContextSheetOpen: boolean;
  setMobileContextSheetOpen: (open: boolean) => void;
  notifications: NotificationItem[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  activeSchoolId: string;
  setActiveSchoolId: (id: string) => void;
  activeBranchId: string;
  setActiveBranchId: (id: string) => void;
  activeSession: string;
  setActiveSession: (session: string) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [aiCommandOpen, setAiCommandOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileContextSheetOpen, setMobileContextSheetOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [activeSchoolId, setActiveSchoolId] = useState(MOCK_SCHOOLS[0].id);
  const [activeBranchId, setActiveBranchId] = useState(MOCK_BRANCHES[0].id);
  const [activeSession, setActiveSession] = useState(MOCK_SESSIONS[1]);

  // Global ⌘K / Ctrl+K shortcut for global search.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = useMemo<ShellContextValue>(
    () => ({
      sidebarCollapsed,
      toggleSidebarCollapsed: () => setSidebarCollapsed((collapsed) => !collapsed),
      tabletDrawerOpen,
      setTabletDrawerOpen,
      mobileMoreOpen,
      setMobileMoreOpen,
      commandPaletteOpen,
      setCommandPaletteOpen,
      aiCommandOpen,
      setAiCommandOpen,
      notificationCenterOpen,
      setNotificationCenterOpen,
      mobileSearchOpen,
      setMobileSearchOpen,
      mobileContextSheetOpen,
      setMobileContextSheetOpen,
      notifications,
      unreadCount,
      markNotificationRead: (id: string) =>
        setNotifications((items) => items.map((item) => (item.id === id ? { ...item, read: true } : item))),
      markAllNotificationsRead: () => setNotifications((items) => items.map((item) => ({ ...item, read: true }))),
      activeSchoolId,
      setActiveSchoolId,
      activeBranchId,
      setActiveBranchId,
      activeSession,
      setActiveSession,
    }),
    [
      sidebarCollapsed,
      tabletDrawerOpen,
      mobileMoreOpen,
      commandPaletteOpen,
      aiCommandOpen,
      notificationCenterOpen,
      mobileSearchOpen,
      mobileContextSheetOpen,
      notifications,
      unreadCount,
      activeSchoolId,
      activeBranchId,
      activeSession,
    ],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error("useShell must be used within a ShellProvider");
  }
  return context;
}
