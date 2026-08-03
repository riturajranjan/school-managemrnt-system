"use client"

import { motion } from "framer-motion"
import { Bus, CheckCircle2, Users } from "lucide-react"

const floatingMarkers = [
  {
    id: "attendance",
    label: "96.4% present",
    icon: CheckCircle2,
    className: "top-[6%] left-[6%]",
    tone: "text-success",
    delay: 0,
  },
  {
    id: "bus",
    label: "Bus Route 04 arriving",
    icon: Bus,
    className: "bottom-[20%] left-[2%]",
    tone: "text-accent-cyan",
    delay: 0.4,
  },
  {
    id: "students",
    label: "1,842 on campus",
    icon: Users,
    className: "top-[10%] right-[4%]",
    tone: "text-accent-violet",
    delay: 0.8,
  },
]

export function IsometricCampus() {
  return (
    <div
      className="relative mx-auto aspect-[4/3] w-full max-w-[440px]"
      role="img"
      aria-label="Isometric illustration of Horizon International School campus with a bus and students at the entrance"
    >
      <svg viewBox="0 0 480 360" className="size-full" aria-hidden="true">
        <defs>
          <filter id="campus-ground-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <linearGradient id="campus-wall-right" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.92" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.78" />
          </linearGradient>
        </defs>

        {/* ambient ground shadow */}
        <ellipse cx="248" cy="298" rx="150" ry="34" fill="oklch(0.1 0.02 265 / 22%)" filter="url(#campus-ground-shadow)" />

        {/* ground plane */}
        <polygon
          points="60,260 240,150 430,260 240,370"
          fill="var(--surface-2)"
          stroke="var(--border)"
          strokeWidth="1"
        />

        {/* entrance path */}
        <polygon points="205,285 240,265 292,296 258,318" fill="var(--background)" opacity="0.9" />

        {/* trees */}
        {[
          { x: 96, y: 232 },
          { x: 130, y: 202 },
          { x: 400, y: 214 },
        ].map((tree, i) => (
          <g key={i} transform={`translate(${tree.x} ${tree.y})`}>
            <rect x="-2.5" y="10" width="5" height="14" rx="1.5" fill="var(--muted-foreground)" opacity="0.5" />
            <circle cx="0" cy="0" r="13" fill="oklch(0.62 0.11 150)" opacity="0.85" />
            <circle cx="-7" cy="5" r="9" fill="oklch(0.62 0.11 150)" opacity="0.7" />
            <circle cx="7" cy="5" r="9" fill="oklch(0.62 0.11 150)" opacity="0.7" />
          </g>
        ))}

        {/* main building block */}
        <g>
          {/* left wall */}
          <polygon points="188,270 240,300 240,205 188,175" fill="var(--card)" stroke="var(--border)" strokeWidth="1" />
          {/* right wall */}
          <polygon points="240,300 292,270 292,175 240,205" fill="url(#campus-wall-right)" stroke="var(--border)" strokeWidth="1" />
          {/* roof / top face */}
          <polygon points="188,175 240,145 292,175 240,205" fill="var(--muted)" stroke="var(--border)" strokeWidth="1" />

          {/* window band — left wall */}
          <polygon points="196,240 232,262 232,222 196,200" fill="var(--accent-cyan)" opacity="0.28" />
          {/* window band — right wall */}
          <polygon points="248,262 284,240 284,200 248,222" fill="var(--accent-cyan)" opacity="0.35" />

          {/* entrance door */}
          <polygon points="226,283 240,291 240,262 226,254" fill="var(--foreground)" opacity="0.16" />

          {/* rooftop pennant */}
          <line x1="240" y1="145" x2="240" y2="122" stroke="var(--muted-foreground)" strokeWidth="1.5" />
          <polygon points="240,122 258,128 240,134" fill="var(--accent-violet)" />
        </g>

        {/* small bus on the path */}
        <g transform="translate(300 305)">
          <rect x="-26" y="-16" width="46" height="20" rx="4" fill="var(--warning)" />
          <polygon points="20,-16 32,-9 32,4 20,4" fill="var(--warning)" opacity="0.85" />
          <rect x="-20" y="-11" width="12" height="9" rx="1.5" fill="var(--background)" opacity="0.85" />
          <rect x="-4" y="-11" width="12" height="9" rx="1.5" fill="var(--background)" opacity="0.85" />
          <circle cx="-14" cy="6" r="4.5" fill="var(--foreground)" opacity="0.7" />
          <circle cx="14" cy="6" r="4.5" fill="var(--foreground)" opacity="0.7" />
        </g>

        {/* minimal student silhouettes near entrance */}
        {[
          { x: 214, y: 300 },
          { x: 228, y: 312 },
          { x: 250, y: 308 },
        ].map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y})`}>
            <circle cx="0" cy="-8" r="3" fill="var(--foreground)" opacity="0.55" />
            <rect x="-3" y="-5" width="6" height="9" rx="2.5" fill="var(--foreground)" opacity="0.4" />
          </g>
        ))}
      </svg>

      {floatingMarkers.map((marker) => (
        <motion.div
          key={marker.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: [0, -6, 0] }}
          transition={{
            opacity: { duration: 0.4, delay: marker.delay },
            y: { duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: marker.delay },
          }}
          className={`absolute flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-elevated backdrop-blur-md ${marker.className}`}
        >
          <marker.icon className={`size-3.5 ${marker.tone}`} />
          <span className="whitespace-nowrap">{marker.label}</span>
        </motion.div>
      ))}
    </div>
  )
}
