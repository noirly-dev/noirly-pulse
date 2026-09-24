"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { api } from "@/src/lib/api-client";
import { useUnreadStore } from "@/src/stores/ui-store";

const DEBOUNCE_MS = 800;

/**
 * Batched read-receipt persistence (ARCHITECTURE §11.5).
 *
 * `noteRead(id)` records the newest message the user has actually seen; the
 * PUT is debounced 800ms and flushed immediately on conversation change,
 * tab hide, and pagehide. Ids only move forward.
 */
export function useReadReceipts(conversationId: string) {
  const queryClient = useQueryClient();
  const pending = useRef<string | null>(null);
  const sent = useRef<string | null>(null);
  const timer = useRef<number | null>(null);

  const flush = useCallback(
    (options: { keepalive?: boolean } = {}) => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
      const id = pending.current;
      if (!id || id === sent.current) return;
      sent.current = id;
      pending.current = null;
      useUnreadStore.getState().clear(conversationId);
      if (options.keepalive) {
        void fetch(`/api/conversations/${conversationId}/read`, {
          method: "PUT",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastReadMessageId: id }),
        }).catch(() => undefined);
        return;
      }
      void api
        .markRead(conversationId, id)
        .then(() => queryClient.invalidateQueries({ queryKey: ["conversations"] }))
        .catch(() => {
          sent.current = null;
        });
    },
    [conversationId, queryClient],
  );

  const noteRead = useCallback(
    (messageId: string) => {
      if (messageId.startsWith("tmp-")) return;
      const newest = pending.current ?? sent.current;
      if (newest && newest >= messageId) return;
      pending.current = messageId;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flush(), DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") flush({ keepalive: true });
    }
    function onPageHide() {
      flush({ keepalive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      flush();
    };
  }, [flush]);

  return { noteRead, flush };
}
