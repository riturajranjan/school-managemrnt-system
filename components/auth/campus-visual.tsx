"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, GraduationCap, ShieldCheck, Users } from "lucide-react";

/** Signature "Campus Access" scene — a layered isometric campus with floating
 * functional chips. SVG + CSS transforms + Framer Motion only; no WebGL.
 * Simplified on mobile (the whole visual panel is hidden < lg). */
export function CampusVisual() {
  const reduce = useReducedMotion();
  const float = (delay: number) =>
    reduce
      ? {}
      : {
          animate: { y: [0, -8, 0] },
          transition: {
            duration: 5 + delay,
            repeat: Infinity,
            ease: "easeInOut" as const,
          },
        };
  const enter = (d: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: reduce ? 0 : d, duration: 0.5 },
  });

  return (
    <div className="relative hidden overflow-hidden bg-[linear-gradient(160deg,#022c43_0%,#0a3a52_55%,#18b0c8_140%)] lg:flex lg:flex-col lg:justify-between">
      {/* soft depth blobs */}
      <div
        className="pointer-events-none absolute -left-20 top-10 size-72 rounded-full bg-white/5 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-10 bottom-24 size-80 rounded-full bg-[#18b0c8]/20 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 p-xl">
        <div className="flex items-center gap-2 text-white">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/15 text-lg font-bold">
            N
          </span>
          <span className="text-sm font-semibold">Novyra Campus OS</span>
        </div>
        <motion.h2
          {...enter(0.1)}
          className="mt-2xl  text-2xl font-bold leading-tight text-white">
          One secure sign-in for your entire campus.
        </motion.h2>
        <motion.p {...enter(0.2)} className="mt-2  text-sm text-white/70">
          Students, parents, teachers and administration — unified in a single,
          calm workspace.
        </motion.p>
      </div>

      {/* Isometric campus scene */}
      <div
        className="relative z-10 mx-auto w-full  px-xl pb-2xl"
        style={{ perspective: "1000px" }}>
        <motion.div
          {...enter(0.25)}
          className="relative mx-auto aspect-square w-full max-w-sm"
          style={{
            transformStyle: "preserve-3d",
            transform: "rotateX(52deg) rotateZ(-42deg)",
          }}>
          {/* base platform */}
          <div className="absolute inset-x-6 inset-y-10 rounded-2xl bg-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.35)]" />
          {/* building block */}
          <motion.div
            {...float(0)}
            className="absolute left-1/2 top-1/2 h-24 w-32 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white shadow-xl"
            style={{ transform: "translateZ(48px) translate(-50%,-50%)" }}>
            <div className="grid grid-cols-4 gap-1 p-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} className="h-3 rounded-sm bg-[#18b0c8]/40" />
              ))}
            </div>
            <div className="mx-auto h-3 w-8 rounded-t bg-[#022c43]" />
          </motion.div>
          {/* left wing */}
          <div
            className="absolute left-6 top-1/2 h-16 w-20 -translate-y-1/2 rounded-lg bg-white/90 shadow-lg"
            style={{ transform: "translateZ(24px)" }}
          />
          {/* right wing */}
          <div
            className="absolute right-6 top-1/3 h-14 w-16 rounded-lg bg-white/80 shadow-lg"
            style={{ transform: "translateZ(30px)" }}
          />
        </motion.div>
      </div>

      {/* Floating functional chips (upright, over the scene) */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <motion.div {...float(0.4)} className="absolute left-8 top-1/3">
          <Chip icon={GraduationCap} title="Student card" sub="ID / QR ready" />
        </motion.div>
        <motion.div {...float(0.9)} className="absolute right-10 top-[42%]">
          <Chip icon={Users} title="Parent access" sub="Multi-child" />
        </motion.div>
        <motion.div {...float(0.2)} className="absolute left-12 bottom-1/3">
          <Chip icon={ShieldCheck} title="Secure access" sub="Role-aware" />
        </motion.div>
        <motion.div {...float(0.7)} className="absolute right-8 bottom-[30%]">
          <Chip icon={CalendarDays} title="2026 – 2027" sub="Active session" />
        </motion.div>
      </div>
    </div>
  );
}

function Chip({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Users;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 backdrop-blur-sm">
      <span className="flex size-6 items-center justify-center rounded-md bg-white/20 text-white">
        <Icon className="size-3.5" />
      </span>
      <span className="leading-tight">
        <span className="block text-[11px] font-semibold text-white">
          {title}
        </span>
        <span className="block text-[9px] text-white/60">{sub}</span>
      </span>
    </div>
  );
}
