"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";

export function useConversations() {
  return useSisStore().conversations;
}

export function useConversation(conversationId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.conversations.find((c) => c.id === conversationId), [db.conversations, conversationId]);
}

export function useMessages(conversationId: string | undefined) {
  const db = useSisStore();
  return useMemo(
    () => (conversationId ? db.messages.filter((m) => m.conversationId === conversationId).sort((a, b) => a.sentAt.localeCompare(b.sentAt)) : []),
    [db.messages, conversationId],
  );
}

export function useParticipant(id: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.conversationParticipants.find((p) => p.id === id), [db.conversationParticipants, id]);
}

export function useGroups() {
  return useSisStore().commGroups;
}

export function useAnnouncements() {
  return useSisStore().commAnnouncements;
}

export function useNotices() {
  return useSisStore().commNotices;
}

export function useBroadcasts() {
  return useSisStore().commBroadcasts;
}

export function useTemplates() {
  return useSisStore().commTemplates;
}

export function useScheduledCommunications() {
  return useSisStore().scheduledCommunications;
}

export function useCommNotifications() {
  return useSisStore().commNotifications;
}

export function useNotificationSettings() {
  return useSisStore().notificationSettings;
}

export function useTickets() {
  return useSisStore().helpdeskTickets;
}

export function useTicket(ticketId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.helpdeskTickets.find((t) => t.id === ticketId), [db.helpdeskTickets, ticketId]);
}

export function useTicketReplies(ticketId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => (ticketId ? db.ticketReplies.filter((r) => r.ticketId === ticketId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []), [db.ticketReplies, ticketId]);
}

export function useKnowledgeArticles() {
  return useSisStore().knowledgeArticles;
}

// Phase 9I: useVisitors()/useVisitorAppointments() were deleted — zero
// remaining consumers after the real /api/visitors/* cutover (see
// lib/hooks/api/use-visitors-api.ts). lib/selectors/communication-brief.ts
// still reads db.visitors/db.visitorAppointments directly (not through
// these hooks) for the unrelated, not-migrated Communication Hub dashboard
// (app/communication/page.tsx) — retained, documented in the Phase 9I
// final report.

export function useGatePasses() {
  return useSisStore().gatePasses;
}

export function useReceptionCalls() {
  return useSisStore().receptionCalls;
}

export function useDeliveries() {
  return useSisStore().deliveries;
}

export function useFrontDeskIncidents() {
  return useSisStore().frontDeskIncidents;
}
