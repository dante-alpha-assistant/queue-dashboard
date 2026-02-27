import { useState, useEffect, useCallback, useRef } from "react";

export default function useQueue() {
  const [stats, setStats] = useState({ pending: 0, processing: 0, completed: 0, failed: 0, dlq: 0 });
  const [tasks, setTasks] = useState([]);
  const [processing, setProcessing] = useState([]);
  const [results, setResults] = useState([]);
  const [dlq, setDlq] = useState([]);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, tRes, pRes, rRes, dRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/tasks"),
        fetch("/api/processing"),
        fetch("/api/results?limit=20"),
        fetch("/api/dlq"),
      ]);
      const [s, t, p, r, d] = await Promise.all([
        sRes.json(), tRes.json(), pRes.json(), rRes.json(), dRes.json(),
      ]);
      setStats(s);
      setTasks(t);
      setProcessing(p);
      setResults(r);
      setDlq(d);
      if (initialLoad.current) {
        setLoading(false);
        initialLoad.current = false;
      }
    } catch (e) {
      console.error("Poll error:", e);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 3000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const dispatch = useCallback(async (task) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    if (!res.ok) throw new Error("Dispatch failed");
    await fetchAll();
    return res.json();
  }, [fetchAll]);

  const retryDlq = useCallback(async (taskId) => {
    const res = await fetch("/api/dlq/" + taskId + "/retry", { method: "POST" });
    if (!res.ok) throw new Error("Retry failed");
    await fetchAll();
  }, [fetchAll]);

  return { stats, tasks, processing, results, dlq, loading, dispatch, retryDlq };
}
