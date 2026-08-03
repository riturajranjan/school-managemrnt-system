"use client";

import { useEffect, useState } from "react";

export type WidgetDataState<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; data: T };

/** Fetches widget data on mount, exposing loading/error/ready state plus a retry. */
export function useWidgetData<T>(fetcher: () => Promise<T>): WidgetDataState<T> & { retry: () => void } {
  const [state, setState] = useState<WidgetDataState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: "error", error: error instanceof Error ? error : new Error("Failed to load") });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, attempt]);

  function retry() {
    // Synchronous reset lives in the event handler, not the effect body —
    // the effect only ever calls setState from the async fetch callbacks.
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  }

  return { ...state, retry };
}
