"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

type FilterValue = string | string[] | boolean | undefined;
type FilterDefaults = Record<string, FilterValue>;

// Generic URL <-> filter-object sync so every list page (Admissions, Students,
// Parents) can share one implementation of "filters live in the URL and
// survive navigate-away-and-back". One search param per key; arrays are
// comma-joined, booleans are "true"/absent.
export function useUrlFilters<T extends FilterDefaults>(defaults: T) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  const state = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const raw = searchParams.get(key);
      if (raw === null) continue;
      const defaultValue = defaults[key];
      if (Array.isArray(defaultValue)) {
        (result as Record<string, FilterValue>)[key] = raw.split(",").filter(Boolean);
      } else if (typeof defaultValue === "boolean") {
        (result as Record<string, FilterValue>)[key] = raw === "true";
      } else {
        (result as Record<string, FilterValue>)[key] = raw;
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsKey, defaults]);

  const setFilters = useCallback(
    (patch: Partial<T>) => {
      const params = new URLSearchParams(searchParamsKey);
      for (const [key, value] of Object.entries(patch)) {
        const isEmpty = value === undefined || value === "" || value === false || (Array.isArray(value) && value.length === 0);
        if (isEmpty) params.delete(key);
        else if (Array.isArray(value)) params.set(key, value.join(","));
        else params.set(key, String(value));
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParamsKey],
  );

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  return { filters: state, setFilters, clearAll };
}
