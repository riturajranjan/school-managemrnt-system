"use client";

import { useState, useSyncExternalStore } from "react";
import { weekDays, type WeekDay } from "@/lib/types/timetable";

// Tablet band only (md–lg, ~768–1023px) — below it MobileDayView takes over
// with a single day, above it the full 6-day grid fits comfortably.
const TABLET_QUERY = "(min-width: 768px) and (max-width: 1023.98px)";

function subscribe(callback: () => void) {
  const query = window.matchMedia(TABLET_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(TABLET_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

const WINDOW_SIZE = 3;

/** Tablet-only 3-day rolling window over the week, with prev/next controls. Desktop always sees the full week. */
export function useTabletDayWindow() {
  const isTablet = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [startIndex, setStartIndex] = useState(0);

  const visibleDays: readonly WeekDay[] = isTablet ? weekDays.slice(startIndex, startIndex + WINDOW_SIZE) : weekDays;

  return {
    isTablet,
    visibleDays,
    canGoPrevious: startIndex > 0,
    canGoNext: startIndex + WINDOW_SIZE < weekDays.length,
    goPrevious: () => setStartIndex((i) => Math.max(0, i - WINDOW_SIZE)),
    goNext: () => setStartIndex((i) => Math.min(weekDays.length - WINDOW_SIZE, i + WINDOW_SIZE)),
  };
}
