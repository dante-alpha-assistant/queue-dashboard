import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// Lightweight columns for list view — exclude heavy JSON blobs
const LIST_COLUMNS = "id,title,status,type,priority,assigned_agent,created_at,updated_at,error,deploy_target,pull_request_url,deployment_url,started_at,completed_at,paused,blocked_reason,stage,repository_url,project_id,repository_id,app_id,project:agent_projects(id,name,slug),repository:agent_repositories(id,name,url,provider),app:apps(id,name,slug,icon)";

export default function useQueue({ since, until } = {}) {
  const [stats, setStats] = useState({ todo: 0, assigned: 0, in_progress: 0, qa: 0, completed: 0, failed: 0 });
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(() => {
    try { return localStorage.getItem("selected-app") || ""; } catch { return ""; }
  });
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState({});
  const initialLoad = useRef(true);

  // Stable wrapper — must be a top-level hook call, NOT in the return statement
  const wrappedSetSelectedApp = useCallback((val) => {
    setSelectedApp(val);
    try { localStorage.setItem("selected-app", val); } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedProject) params.set("project_id", selectedProject);
      if (since) params.set("since", since);
      if (until) params.set("until", until);
      params.set("columns", "light");
      const qs = params.toString() ? `?${params}` : "";

      const [sRes, tRes, pRes, aRes] = await Promise.all([
        fetch(`/api/stats${selectedProject ? `?project_id=${selectedProject}` : ""}`),
        fetch(`/api/tasks${qs}`),
        fetch("/api/projects"),
        fetch("/api/apps"),
      ]);
      setStats(await sRes.json());
      const newTasks = await tRes.json();
      if (Array.isArray(newTasks)) setTasks(newTasks);
      setProjects(await pRes.json());
      const appsData = await aRes.json();
      if (Array.isArray(appsData)) setApps(appsData);
      if (initialLoad.current) {
        setLoading(false);
        initialLoad.current = false;
      }
    } catch (e) {
      console.error("Poll error:", e);
    }
  }, [selectedProject, since, until]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 10000); // 10s instead of 3s
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

  const applyStatusChange = useCallback((taskId, newStatus) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t
    ));
    fetchAll();
  }, [fetchAll]);

  const { todo, assigned, inProgress, qa, completed, blocked, failed, deployed, deploying, deployFailed } = useMemo(() => ({
    todo: tasks.filter(t => t.status === "todo"),
    assigned: [],
    inProgress: tasks.filter(t => t.status === "in_progress"),
    qa: tasks.filter(t => t.status === "qa" || t.status === "qa_testing"),
    completed: tasks.filter(t => t.status === "completed"),
    blocked: tasks.filter(t => t.status === "blocked"),
    failed: tasks.filter(t => t.status === "failed"),
    deployed: tasks.filter(t => t.status === "deployed"),
    deploying: tasks.filter(t => t.status === "deploying"),
    deployFailed: tasks.filter(t => t.status === "deploy_failed"),
  }), [tasks]);

  return {
    stats, tasks, todo, assigned, inProgress, qa, completed, deployed, blocked, failed, deploying, deployFailed,
    loading, transitioning, dispatch, updateTask, deleteTask, applyStatusChange,
    projects, selectedProject, setSelectedProject,
    apps, selectedApp, setSelectedApp: wrappedSetSelectedApp,
  };
}
