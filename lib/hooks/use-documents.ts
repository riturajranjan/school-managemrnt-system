"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";
import type { DocumentKind, IdCardKind } from "@/lib/types/documents";

// Templates
export function useDocumentTemplates(kind?: DocumentKind) {
  const db = useSisStore();
  return useMemo(() => (kind ? db.documentTemplates.filter((t) => t.kind === kind) : db.documentTemplates), [db.documentTemplates, kind]);
}
export function useDocumentTemplate(id: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.documentTemplates.find((t) => t.id === id), [db.documentTemplates, id]);
}

// Generated documents
export function useGeneratedDocuments() { return useSisStore().generatedDocuments; }
export function useGeneratedDocument(id: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.generatedDocuments.find((d) => d.id === id), [db.generatedDocuments, id]);
}
export function useDocumentVersions(documentId?: string) {
  const db = useSisStore();
  return useMemo(() => (documentId ? [...db.documentVersions.filter((v) => v.documentId === documentId)].sort((a, b) => b.version - a.version) : db.documentVersions), [db.documentVersions, documentId]);
}

// ID cards
export function useIdCards(kind?: IdCardKind) {
  const db = useSisStore();
  return useMemo(() => (kind ? db.idCards.filter((c) => c.kind === kind) : db.idCards), [db.idCards, kind]);
}
export function useIdCard(id: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.idCards.find((c) => c.id === id), [db.idCards, id]);
}

// Batches
export function useDocumentBatches() { return useSisStore().documentBatches; }
export function useDocumentBatch(id: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.documentBatches.find((b) => b.id === id), [db.documentBatches, id]);
}
export function useBatchItems(batchId?: string) {
  const db = useSisStore();
  return useMemo(() => (batchId ? db.documentBatchItems.filter((i) => i.batchId === batchId) : db.documentBatchItems), [db.documentBatchItems, batchId]);
}

// Print queue
export function usePrintQueue() { return useSisStore().printQueue; }

// Verification & settings
export function useVerificationRecords() { return useSisStore().verificationRecords; }
export function useNumberingRules() { return useSisStore().documentNumberingRules; }
export function useSignatories() { return useSisStore().signatoryProfiles; }
