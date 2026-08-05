"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "scrollbar-none flex shrink-0 items-center gap-xs overflow-x-auto rounded-md bg-surface-secondary p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "flex min-h-9 shrink-0 items-center gap-xs whitespace-nowrap rounded-md px-sm text-xs font-medium text-muted-foreground outline-none transition-colors data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-card focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}
