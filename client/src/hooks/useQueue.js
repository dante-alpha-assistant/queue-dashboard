import { useState, useEffect, useCallback, useRef } from "react";

export default function useQueue() {
  const [stats, setStats] = useState({ todo: 0, assigned: 0, in_progress: 0, done: 0, qa: 0, completed: 0, failed: 0 });
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  const fetchAll = useCallback(async () => {
    try {
      const params = selectedProject ? `?project_id=${selectedProject}` : "";
      const [sRes, tRes, pRes] = await Promise.all([
        fetch(`/api/stats${params}`),
        fetch(`/api/tasks${params}`),
        fetch("/api/projects"),
      ]);
      setStats(await sRes.json());
      setTasks(await tRes.json());
      setProjects(await pRes.json());
      if (initialLoad.current) {
        setLoading(false);
        initialLoad.current = false;
      }
    } catch (e) {
      console.error("Poll error:", e);
    }
  }, [selectedProject]);

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

  const todo = tasks.filter(t => t.status === "todo");
  const assigned = tasks.filter(t => t.status === "assigned");
  const inProgress = tasks.filter(t => t.status === "in_progress");
  const done = tasks.filter(t => t.status === "done");
  const qa = tasks.filter(t => t.status === "qa");
  const completed = tasks.filter(t => t.status === "completed");
  const failed = tasks.filter(t => t.status === "failed");

  return {
    stats, tasks, todo, assigned, inProgress, done, qa, completed, failed,
    loading, dispatch, updateTask, deleteTask,
    projects, selectedProject, setSelectedProject,
  };
}
