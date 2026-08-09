"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiGet, apiPost } from "@/lib/api/client";
import { initialNotifications, type NotificationItem } from "./notification-data";

// Real workspace-context shapes (from /api/auth/context*). Kept light on the client.
type IdName = { id: string; name: string };
type SchoolOption = { id: string; name: string; code: string };
type BranchOption = { id: string; name: string; code: string; isPrimary: boolean };
type SessionOption = { id: string; name: string; code: string; isCurrent: boolean };
type CurrentContext = {
  tenant: IdName | null;
  school: IdName | null;
  role: IdName | null;
  branch: IdName | null;
  academicSession: IdName | null;
};

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

  // Real workspace context (server-authoritative; selections persist in the DB).
  contextLoading: boolean;
  schools: SchoolOption[];
  branches: BranchOption[];
  sessions: SessionOption[];
  activeSchoolId: string;
  activeSchoolName: string;
  activeBranchId: string;
  activeBranchName: string;
  activeSessionId: string;
  activeSession: string; // session display name (kept for existing consumers)
  setActiveSchoolId: (id: string) => void;
  setActiveBranchId: (id: string) => void;
  setActiveSessionId: (id: string) => void;
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

  // Real context state.
  const [contextLoading, setContextLoading] = useState(true);
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);

  // Fetch-only (no setState) so both the mount effect and refresh can apply
  // results in their own scope — keeps setState out of the synchronous effect path.
  const loadAll = useCallback(async () => {
    const [ctx, sch] = await Promise.all([
      apiGet<CurrentContext>("/api/auth/context"),
      apiGet<SchoolOption[]>("/api/auth/context/schools"),
    ]);
    const [br, ses] = await Promise.all([
      apiGet<BranchOption[]>("/api/auth/context/branches"),
      apiGet<SessionOption[]>("/api/auth/context/academic-sessions"),
    ]);
    return { ctx, sch, br, ses };
  }, []);

  const applyResults = useCallback((r: Awaited<ReturnType<typeof loadAll>>) => {
    if (r.ctx.success) setContext(r.ctx.data);
    if (r.sch.success) setSchools(r.sch.data);
    if (r.br.success) setBranches(r.br.data);
    if (r.ses.success) setSessions(r.ses.data);
    setContextLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    applyResults(await loadAll());
  }, [loadAll, applyResults]);

  useEffect(() => {
    let active = true;
    loadAll().then((r) => {
      if (active) applyResults(r);
    });
    return () => {
      active = false;
    };
  }, [loadAll, applyResults]);

  const setActiveSchoolId = useCallback(
    async (id: string) => {
      const res = await apiPost("/api/auth/context/school", { schoolId: id });
      if (res.success) await refresh();
    },
    [refresh],
  );
  const setActiveBranchId = useCallback(
    async (id: string) => {
      const res = await apiPost("/api/auth/context/branch", { branchId: id });
      if (res.success) await refresh();
    },
    [refresh],
  );
  const setActiveSessionId = useCallback(
    async (id: string) => {
      const res = await apiPost("/api/auth/context/academic-session", { academicSessionId: id });
      if (res.success) await refresh();
    },
    [refresh],
  );

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
      contextLoading,
      schools,
      branches,
      sessions,
      activeSchoolId: context?.school?.id ?? "",
      activeSchoolName: context?.school?.name ?? "",
      activeBranchId: context?.branch?.id ?? "",
      activeBranchName: context?.branch?.name ?? "",
      activeSessionId: context?.academicSession?.id ?? "",
      activeSession: context?.academicSession?.name ?? "",
      setActiveSchoolId: (id) => void setActiveSchoolId(id),
      setActiveBranchId: (id) => void setActiveBranchId(id),
      setActiveSessionId: (id) => void setActiveSessionId(id),
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
      contextLoading,
      schools,
      branches,
      sessions,
      context,
      setActiveSchoolId,
      setActiveBranchId,
      setActiveSessionId,
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
