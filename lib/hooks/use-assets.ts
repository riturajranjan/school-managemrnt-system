"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";

export function useAssets() {
  return useSisStore().assets;
}

export function useAsset(assetId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.assets.find((a) => a.id === assetId), [db.assets, assetId]);
}

export function useAssetCategories() {
  return useSisStore().assetCategories;
}

export function useAssetAssignments(assetId?: string) {
  const db = useSisStore();
  return useMemo(() => (assetId ? db.assetAssignments.filter((a) => a.assetId === assetId) : db.assetAssignments), [db.assetAssignments, assetId]);
}

export function useAssetMaintenance(assetId?: string) {
  const db = useSisStore();
  return useMemo(() => (assetId ? db.assetMaintenance.filter((m) => m.assetId === assetId) : db.assetMaintenance), [db.assetMaintenance, assetId]);
}

export function useAssetDisposals() {
  return useSisStore().assetDisposals;
}
