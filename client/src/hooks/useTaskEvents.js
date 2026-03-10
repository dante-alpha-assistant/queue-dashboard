import { useState, useEffect, useRef, useCallback } from "react";

/**
 * SSE hook that connects to the task-dispatcher's event stream via the dashboard proxy.
 * Maintains per-task progress and monitor data.
 * Accepts optional onStatusChange callback for optimistic board updates.
 */
export default function useTaskEvents({ onStatusChange } = {}) {
  const [progress, setProgress] = useState({}); // taskId → { percent, step, log, timestamp }
  const [monitor, setMonitor] = useState({});   // taskId → { sessionAlive, idleSeconds, elapsed, timestamp }
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  const retryRef = useRef(null);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  // Debounce SSE status events to prevent cascade refreshes
  const statusDebounceRef = useRef(null);
  const pendingStatusRef = useRef(new Map());

  const flushStatusUpdates = useCallback(() => {
    const pending = pendingStatusRef.current;
    if (pending.size === 0) return;
    for (const [taskId, status] of pending) {
      if (onStatusChangeRef.current) {
        onStatusChangeRef.current(taskId, status);
      }
    }
    pending.clear();
  }, []);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource("/api/events");
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };

    es.addEventListener("task:progress", (e) => {
      try {
        const data = JSON.parse(e.data);
        setProgress((prev) => ({
          ...prev,
          [data.taskId]: {
            percent: data.percent,
            step: data.step,
            log: data.log,
            timestamp: data.timestamp,
          },
        }));
      } catch {}
    });

    es.addEventListener("task:monitor", (e) => {
      try {
        const data = JSON.parse(e.data);
        setMonitor((prev) => ({
          ...prev,
          [data.taskId]: {
            sessionAlive: data.sessionAlive,
            idleSeconds: data.idleSeconds,
            elapsed: data.elapsed,
            timestamp: data.timestamp,
          },
        }));
      } catch {}
    });

    es.addEventListener("task:status", (e) => {
      try {
        const data = JSON.parse(e.data);
        // Clean up progress/monitor for terminal tasks
        if (["failed", "deployed", "cancelled", "deprecated"].includes(data.status)) {
          setProgress((prev) => {
            const next = { ...prev };
            delete next[data.taskId];
            return next;
          });
          setMonitor((prev) => {
            const next = { ...prev };
            delete next[data.taskId];
            return next;
          });
        }
        // Debounce status changes - batch within 500ms window
        pendingStatusRef.current.set(data.taskId, data.status);
        if (statusDebounceRef.current) clearTimeout(statusDebounceRef.current);
        statusDebounceRef.current = setTimeout(flushStatusUpdates, 500);
      } catch {}
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      // Retry with backoff
      retryRef.current = setTimeout(connect, 5000);
    };
  }, [flushStatusUpdates]);

  useEffect(() => {
    connect();
    return () => {
      if (esRef.current) esRef.current.close();
      if (retryRef.current) clearTimeout(retryRef.current);
      if (statusDebounceRef.current) clearTimeout(statusDebounceRef.current);
    };
  }, [connect]);

  // Clear stale progress entries (older than 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - 5 * 60 * 1000;
      setProgress((prev) => {
        const next = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v.timestamp && new Date(v.timestamp).getTime() > cutoff) {
            next[k] = v;
          }
        }
        return next;
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  return { progress, monitor, connected };
}
