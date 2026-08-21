"use client";

// Real client hooks for Communication / Messaging (Phase 9K). Read/write the
// live /api/communication/* endpoints — no mock store, no fake conversations.
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList } from "./use-api";
import type {
  ConversationDetailDto,
  ConversationListItemDto,
  MessageDto,
  MessageHistoryDto,
  MessagingRecipientDto,
  StartDirectConversationRequest,
} from "@/lib/api/contracts";

export function useConversations() {
  return useApiList<ConversationListItemDto>("/api/communication/conversations");
}

export function useRecipients(search: string) {
  return useApiList<MessagingRecipientDto>(`/api/communication/recipients${buildQuery({ search: search || undefined })}`);
}

export const startDirectConversationRequest = (body: StartDirectConversationRequest): Promise<ApiResult<ConversationDetailDto>> =>
  apiPost<ConversationDetailDto>("/api/communication/conversations/direct", body);

export const sendMessageRequest = (conversationId: string, body: string): Promise<ApiResult<MessageDto>> =>
  apiPost<MessageDto>(`/api/communication/conversations/${conversationId}/messages`, { body });

export const markConversationReadRequest = (conversationId: string): Promise<ApiResult<{ success: boolean }>> =>
  apiPost<{ success: boolean }>(`/api/communication/conversations/${conversationId}/read`, {});

export function useUnreadCount() {
  const [count, setCount] = useState(0);
  const reload = useCallback(() => {
    apiGet<{ count: number }>("/api/communication/unread-count").then((res) => {
      if (res.success) setCount(res.data.count);
    });
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { count, reload };
}

type MessageHistoryState = {
  items: MessageDto[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
};

/** Cursor-paginated message history for one conversation: initial page newest
 *  first (displayed oldest-first), `loadMore()` fetches older messages,
 *  `append()` optimistically adds a just-sent message to the tail. */
export function useMessageHistory(conversationId: string | null) {
  const [state, setState] = useState<MessageHistoryState>({ items: [], loading: Boolean(conversationId), loadingMore: false, error: null, hasMore: false });
  const cursorRef = useRef<string | null>(null);

  useEffect(() => {
    cursorRef.current = null;
    if (!conversationId) return;
    let cancelled = false;
    apiGet<MessageHistoryDto>(`/api/communication/conversations/${conversationId}/messages`).then((res) => {
      if (cancelled) return;
      if (res.success) {
        cursorRef.current = res.data.nextCursor;
        setState({ items: res.data.items, loading: false, loadingMore: false, error: null, hasMore: Boolean(res.data.nextCursor) });
      } else {
        setState({ items: [], loading: false, loadingMore: false, error: res.error.message, hasMore: false });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const loadMore = useCallback(async () => {
    if (!conversationId || !cursorRef.current) return;
    setState((s) => ({ ...s, loadingMore: true }));
    const res = await apiGet<MessageHistoryDto>(`/api/communication/conversations/${conversationId}/messages${buildQuery({ cursor: cursorRef.current })}`);
    if (res.success) {
      cursorRef.current = res.data.nextCursor;
      setState((s) => ({ ...s, items: [...res.data.items, ...s.items], loadingMore: false, hasMore: Boolean(res.data.nextCursor) }));
    } else {
      setState((s) => ({ ...s, loadingMore: false, error: res.error.message }));
    }
  }, [conversationId]);

  const append = useCallback((message: MessageDto) => {
    setState((s) => ({ ...s, items: [...s.items, message] }));
  }, []);

  return { ...state, loadMore, append };
}
