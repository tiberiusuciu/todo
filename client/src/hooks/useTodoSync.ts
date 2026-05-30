import { useCallback, useEffect, useRef } from "react";

const POLL_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;

function syncWsUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/sync`;
}

type Options = {
  userId?: string;
  onSync: () => Promise<boolean | void>;
  onRemoteChange?: () => void;
};

export function useTodoSync({ userId, onSync, onRemoteChange }: Options) {
  const onSyncRef = useRef(onSync);
  const onRemoteChangeRef = useRef(onRemoteChange);

  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  useEffect(() => {
    onRemoteChangeRef.current = onRemoteChange;
  }, [onRemoteChange]);

  const runSync = useCallback(async () => {
    const changed = await onSyncRef.current();
    if (changed) onRemoteChangeRef.current?.();
  }, []);

  useEffect(() => {
    if (!userId) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let pollTimer: number | undefined;
    let backoffMs = 1000;
    let closed = false;

    const scheduleReconnect = () => {
      if (closed) return;
      window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(connect, backoffMs);
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    };

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(syncWsUrl());

      ws.onopen = () => {
        backoffMs = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as { type?: string };
          if (data.type === "todos:changed") void runSync();
        } catch {
          /* ignore malformed messages */
        }
      };

      ws.onclose = () => {
        ws = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void runSync();
    };

    const onFocus = () => {
      void runSync();
    };

    connect();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    pollTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void runSync();
    }, POLL_MS);

    return () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      ws?.close();
    };
  }, [userId, runSync]);
}
