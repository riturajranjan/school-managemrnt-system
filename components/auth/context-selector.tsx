"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AuthCard, AuthCenter, AuthHeader } from "./auth-shell";
import { SelectCard } from "./selectors";
import { AuthStatus } from "./misc";
import { apiGet, apiPost } from "@/lib/api/client";

// Shared real-data selector for the post-login context steps. Fetches options
// from the context API, persists a choice, then advances via the resolver's
// /api/auth/context/next. Real loading / empty / error(+retry) states — never mock.
export function ContextSelector<T extends { id: string }>({
  title,
  subtitle,
  listUrl,
  postUrl,
  field,
  emptyText,
  renderItem,
}: {
  title: string;
  subtitle: string;
  listUrl: string;
  postUrl: string;
  field: string;
  emptyText: string;
  renderItem: (item: T) => ReactNode;
}) {
  const router = useRouter();
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    apiGet<T[]>(listUrl).then((res) => {
      if (!active) return;
      if (res.success) setItems(res.data);
      else setError(res.error.message);
    });
    return () => {
      active = false;
    };
  }, [listUrl, reloadKey]);

  const retry = () => {
    setItems(null);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  const choose = async (id: string) => {
    setPending(true);
    setError(null);
    const res = await apiPost(postUrl, { [field]: id });
    if (!res.success) {
      setError(res.error.message);
      setPending(false);
      return;
    }
    const next = await apiGet<{ redirectTo: string }>("/api/auth/context/next");
    router.push(next.success ? next.data.redirectTo : "/");
  };

  return (
    <AuthCenter>
      <AuthCard>
        <AuthHeader title={title} subtitle={subtitle} />
        {error && (
          <AuthStatus tone="error">
            {error}{" "}
            <button type="button" className="underline" onClick={retry}>
              Retry
            </button>
          </AuthStatus>
        )}
        <div className="flex flex-col gap-2">
          {items === null && !error && <p className="px-1 text-sm text-muted-foreground">Loading…</p>}
          {items && items.length === 0 && <p className="px-1 text-sm text-muted-foreground">{emptyText}</p>}
          {items?.map((item) => (
            <SelectCard key={item.id} disabled={pending} onClick={() => choose(item.id)}>
              {renderItem(item)}
            </SelectCard>
          ))}
        </div>
      </AuthCard>
    </AuthCenter>
  );
}
