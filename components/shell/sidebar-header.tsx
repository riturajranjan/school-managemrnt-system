import { cn } from "@/lib/utils"
import { EduNexaMark } from "@/components/shell/edunexa-mark"
import { SchoolSwitcher } from "@/components/shell/school-switcher"

export function SidebarHeader({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex flex-col gap-4 px-3 pt-5">
      <div
        className={cn(
          "flex items-center gap-2.5 px-1",
          collapsed && "justify-center px-0"
        )}
      >
        <EduNexaMark className="shrink-0" />
        {!collapsed && (
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[15px] font-semibold tracking-tight text-sidebar-foreground">
              EduNexa
            </span>
            <span className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Digital Campus OS
            </span>
          </div>
        )}
      </div>
      <SchoolSwitcher collapsed={collapsed} />
    </div>
  )
}
