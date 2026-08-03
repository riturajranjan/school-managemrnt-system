import { cn } from "@/lib/utils"

export function EduNexaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("size-8", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="edunexa-mark-gradient" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.55 0.18 266)" />
          <stop offset="100%" stopColor="oklch(0.6 0.22 293)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9.5" fill="url(#edunexa-mark-gradient)" />
      <path
        d="M9 12.5C9 10.567 10.567 9 12.5 9H20.5C21.3284 9 22 9.67157 22 10.5C22 11.3284 21.3284 12 20.5 12H13C12.4477 12 12 12.4477 12 13V13.2C12 13.7523 12.4477 14.2 13 14.2H19.5C20.8807 14.2 22 15.3193 22 16.7C22 18.0807 20.8807 19.2 19.5 19.2H13C12.4477 19.2 12 19.6477 12 20.2V20.4C12 20.9523 12.4477 21.4 13 21.4H20.5C21.3284 21.4 22 22.0716 22 22.9C22 23.7284 21.3284 24.4 20.5 24.4H12.5C10.567 24.4 9 22.833 9 20.9V12.5Z"
        fill="white"
        fillOpacity="0.95"
      />
      <circle cx="23.5" cy="9.5" r="2" fill="oklch(0.75 0.14 210)" />
    </svg>
  )
}
