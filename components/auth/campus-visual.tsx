"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

/** Left-panel campus visual: branding + tagline over the product hero image
 * (public/login.png), which already carries its own "Student card / Secure
 * access / Parent access / 2026-2027" callouts — so no separate floating
 * chips are rendered here. Hidden below lg; the right-side login form
 * (AuthShell) is untouched by this component. */
export function CampusVisual() {
  const reduce = useReducedMotion();
  const enter = (d: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { delay: reduce ? 0 : d, duration: 0.6, ease: "easeOut" as const },
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

      <div className="relative z-10 p-xl pb-0">
        <div className="flex items-center gap-2 text-white">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/15 text-lg font-bold">
            N
          </span>
          <span className="text-sm font-semibold">Novyra Campus OS</span>
        </div>
        <motion.h2
          {...enter(0.1)}
          className="mt-2xl text-2xl font-bold leading-tight text-white">
          One secure sign-in for your entire campus.
        </motion.h2>
        <motion.p {...enter(0.2)} className="mt-2 text-sm text-white/70">
          Students, parents, teachers and administration — unified in a single,
          calm workspace.
        </motion.p>
      </div>

      {/* Hero product visual */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-lg pb-xl pt-md">
        <motion.div
          {...enter(0.3)}
          className="relative aspect-3/2 w-[90%] max-w-180"
          style={{
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%)",
            maskImage: "linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%)",
          }}>
          <Image
            src="/login.png"
            alt="Novyra Campus OS school management dashboard"
            fill
            priority
            sizes="(max-width: 1023px) 0px, (max-width: 1280px) 42vw, 720px"
            className="object-contain"
          />
        </motion.div>
      </div>
    </div>
  );
}
