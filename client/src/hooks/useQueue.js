import { useState, useEffect, useCallback, useRef } from "react";

export default function useQueue() {
  const [stats, setStats] = useState({ todo: 0, assigned: 0, in_progress: 0, done: 0, failed: 0 });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, tRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/tasks"),
      ]);
      setStats(await sRes.json());
      setTasks(await tRes.json());
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

  const updateTask = useCallback(async (id, updates) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Update failed");
    await fetchAll();
  }, [fetchAll]);

  const deleteTask = useCallback(async (id) => {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    await fetchAll();
  }, [fetchAll]);

  // Group tasks by status
  const todo = tasks.filter(t => t.status === "todo");
  const assigned = tasks.filter(t => t.status === "assigned");
  const inProgress = tasks.filter(t => t.status === "in_progress");
  const done = tasks.filter(t => t.status === "done");
  const failed = tasks.filter(t => t.status === "failed");

  return { stats, tasks, todo, assigned, inProgress, done, failed, loading, dispatch, updateTask, deleteTask };
}
