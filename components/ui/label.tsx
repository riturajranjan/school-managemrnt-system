import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("mb-xs block text-xs font-medium text-foreground", className)}
      {...props}
    />
  );
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-xs text-xs font-medium text-error">
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-xs text-xs text-muted-foreground">{children}</p>;
}
