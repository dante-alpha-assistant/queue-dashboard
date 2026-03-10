import { useState, useEffect, useCallback, useRef } from "react";

export default function useQueue() {
  const [stats, setStats] = useState({ todo: 0, assigned: 0, in_progress: 0, qa: 0, completed: 0, failed: 0 });
  const [tasks, setTasks] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState({});
  const initialLoad = useRef(true);
  const etagRef = useRef(null);

  const PER_PAGE = 50;

  const fetchAll = useCallback(async (page = currentPage) => {
    try {
      const params = new URLSearchParams();
      if (selectedProject) params.set("project_id", selectedProject);
      params.set("page", String(page));
      params.set("per_page", String(PER_PAGE));

      const headers = {};
      if (etagRef.current) headers["If-None-Match"] = etagRef.current;

      const [sRes, tRes, pRes] = await Promise.all([
        fetch(`/api/stats${selectedProject ? `?project_id=${selectedProject}` : ""}`),
        fetch(`/api/tasks?${params.toString()}`, { headers }),
        fetch("/api/projects"),
      ]);

      setStats(await sRes.json());

      if (tRes.status === 304) {
        // Data unchanged, skip update
      } else {
        const tasksData = await tRes.json();
        setTasks(tasksData);
        setTotalCount(parseInt(tRes.headers.get("X-Total-Count") || "0", 10));
        setTotalPages(parseInt(tRes.headers.get("X-Total-Pages") || "1", 10));
        const newEtag = tRes.headers.get("ETag");
        if (newEtag) etagRef.current = newEtag;
      }

      setProjects(await pRes.json());
      if (initialLoad.current) {
        setLoading(false);
        initialLoad.current = false;
      }
    } catch (e) {
      console.error("Poll error:", e);
    }
  }, [selectedProject, currentPage]);

  useEffect(() => {
    fetchAll();
    // Poll every 5s instead of 3s to reduce load
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const goToPage = useCallback((page) => {
    setCurrentPage(page);
    etagRef.current = null;
  }, []);

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
    setTransitioning(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.message || errBody?.error || `Update failed (${res.status})`);
      }
      // Optimistic local update
      if (updates.status) {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      }
      await fetchAll();
    } finally {
      setTransitioning(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [fetchAll]);

  const deleteTask = useCallback(async (id) => {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.message || errBody?.error || `Delete failed (${res.status})`);
    }
    await fetchAll();
  }, [fetchAll]);

  // Apply status change from SSE event (optimistic local update)
  const applyStatusChange = useCallback((taskId, newStatus) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    ));
  }, []);

  const todo = tasks.filter(t => t.status === "todo");
  const assigned = [];
  const inProgress = tasks.filter(t => t.status === "in_progress");
  const qa = tasks.filter(t => t.status === "qa" || t.status === "qa_testing");
  const completed = tasks.filter(t => t.status === "completed");
  const blocked = tasks.filter(t => t.status === "blocked");
  const failed = tasks.filter(t => t.status === "failed");
  const deployed = tasks.filter(t => t.status === "deployed");
  const deploying = tasks.filter(t => t.status === "deploying");
  const deployFailed = tasks.filter(t => t.status === "deploy_failed");

  return {
    stats, tasks, todo, assigned, inProgress, qa, completed, deployed, blocked, failed, deploying, deployFailed,
    loading, transitioning, dispatch, updateTask, deleteTask, applyStatusChange,
    projects, selectedProject, setSelectedProject,
    currentPage, totalPages, totalCount, goToPage, PER_PAGE,
  };
}
