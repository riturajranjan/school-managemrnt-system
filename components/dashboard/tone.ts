import type { StatusTone } from "./data/types";

// Centralized status → class mapping so widgets never hardcode color logic.
// Status colors are reserved for state (never reused as a 4th categorical
// hue) and always paired with an icon or text label, never color alone.
export const toneClasses: Record<StatusTone, { text: string; soft: string; dot: string; ring: string }> = {
  success: { text: "text-success", soft: "bg-success/15 text-success", dot: "bg-success", ring: "ring-success/30" },
  warning: { text: "text-warning", soft: "bg-warning/15 text-warning", dot: "bg-warning", ring: "ring-warning/30" },
  error: { text: "text-error", soft: "bg-error/15 text-error", dot: "bg-error", ring: "ring-error/30" },
  info: { text: "text-info", soft: "bg-info/15 text-info", dot: "bg-info", ring: "ring-info/30" },
  neutral: {
    text: "text-muted-foreground",
    soft: "bg-surface-secondary text-muted-foreground",
    dot: "bg-muted-foreground",
    ring: "ring-border",
  },
};
