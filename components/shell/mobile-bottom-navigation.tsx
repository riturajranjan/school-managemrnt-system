"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, GraduationCap, Plus, MessageSquare, UserRound } from "lucide-react"

import { cn } from "@/lib/utils"

const items = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Academics", href: "/students", icon: GraduationCap },
]

const trailingItems = [
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Profile", href: "/settings", icon: UserRound },
]

export function MobileBottomNavigation() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-[26px] border border-sidebar-border bg-sidebar px-2 py-2 shadow-float backdrop-blur-2xl lg:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {items.map((item) => (
        <NavButton key={item.href} item={item} active={pathname === item.href} />
      ))}

      <Link
        href="/quick-create"
        aria-label="Quick create"
        className="-mt-6 flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent-violet text-primary-foreground shadow-glow-primary transition-transform active:scale-95"
      >
        <Plus className="size-6" />
      </Link>

      {trailingItems.map((item) => (
        <NavButton key={item.href} item={item} active={pathname === item.href} />
      ))}
    </nav>
  )
}

function NavButton({
  item,
  active,
}: {
  item: { label: string; href: string; icon: typeof LayoutDashboard }
  active: boolean
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex size-11 flex-col items-center justify-center gap-0.5 rounded-2xl text-muted-foreground transition-colors",
        active && "text-primary"
      )}
    >
      <Icon className="size-[19px]" />
      <span className="sr-only">{item.label}</span>
      {active && (
        <span className="absolute bottom-1 size-1 rounded-full bg-primary" aria-hidden="true" />
      )}
    </Link>
  )
}
