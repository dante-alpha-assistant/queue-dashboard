import { Router } from "express";
import supabase from "../supabase.js";

export const router = Router();

const DISPATCHER_URL = process.env.DISPATCHER_URL || "http://task-dispatcher.agents.svc.cluster.local:8080";

// Manual dispatch — proxy to task-dispatcher
router.post("/dispatch", async (req, res) => {
  try {
    const resp = await fetch(`${DISPATCHER_URL}/api/dispatch`, { method: "POST" });
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ ok: false, error: `Dispatcher unreachable: ${e.message}` });
  }
});

// Projects
router.get("/projects", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("agent_projects")
      .select("*, agent_repositories(*)")
      .order("name");
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Repositories
router.get("/repositories", async (req, res) => {
  try {
    const { project_id } = req.query;
    let query = supabase.from("agent_repositories").select("*").order("name");
    if (project_id) query = query.eq("project_id", project_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stats
router.get("/stats", async (req, res) => {
  try {
    let query = supabase.from("agent_tasks").select("status");
    if (req.query.project_id) query = query.eq("project_id", req.query.project_id);
    const { data, error } = await query;
    if (error) throw error;
    const stats = { todo: 0, assigned: 0, in_progress: 0, qa: 0, qa_testing: 0, completed: 0, failed: 0, deployed: 0, blocked: 0 };
    data.forEach((t) => { if (t.status !== "deprecated" && stats[t.status] !== undefined) stats[t.status]++; });
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// All tasks
router.get("/tasks", async (req, res) => {
  try {
    let query = supabase
      .from("agent_tasks")
      .select("*, project:agent_projects(id, name, slug), repository:agent_repositories(id, name, url, provider)")
      .order("created_at", { ascending: false });
    if (req.query.project_id) query = query.eq("project_id", req.query.project_id);
    if (req.query.repository_id) query = query.eq("repository_id", req.query.repository_id);
    // Hide deprecated tasks by default (soft-deleted); include with ?include_deprecated=true
    if (req.query.include_deprecated !== "true") {
      query = query.neq("status", "deprecated");
    }


    const { since, until } = req.query;
    const ALWAYS_INCLUDE_STATUSES = ["todo", "assigned", "in_progress", "qa_testing", "blocked"];

    if (since || until) {
      // Build an OR filter: (created_at within range) OR (status in always-include list)
      const timeParts = [];
      if (since) timeParts.push(`created_at.gte.${since}`);
      if (until) timeParts.push(`created_at.lte.${until}`);
      const timeFilter = timeParts.join(",");
      const statusFilter = `status.in.(${ALWAYS_INCLUDE_STATUSES.join(",")})`;
      query = query.or(`and(${timeFilter}),${statusFilter}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create task
router.post("/tasks", async (req, res) => {
  try {
    const { title, description, prompt, type, priority, assigned_agent, status, project_id, repository_id, acceptance_criteria, stage } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });

    const { data, error } = await supabase
      .from("agent_tasks")
      .insert({
        title,
        description: description || null,
        prompt: prompt || null,
        type: type || "general",
        priority: priority || "normal",
        assigned_agent: assigned_agent || null,
        status: status || "todo",
        dispatched_by: "dante",
        project_id: project_id || null,
        repository_id: repository_id || null,
        acceptance_criteria: acceptance_criteria || null,
        stage: stage || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update task (status changes, assign agent, etc.)
router.patch("/tasks/:id", async (req, res) => {
  try {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    if (updates.status === "failed") {
      updates.completed_at = new Date().toISOString();
    }
    if (updates.status === "in_progress") {
      updates.started_at = new Date().toISOString();
    }
    if (updates.status === "todo") {
      updates.started_at = null;
      updates.completed_at = null;
      updates.error = null;
      updates.blocked_reason = null;
    }
    if (updates.status === "deprecated") {
      updates.completed_at = updates.completed_at || new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("agent_tasks")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Archive task (soft delete — never actually delete)
router.delete("/tasks/:id", async (req, res) => {
  try {
    // Don't delete — move to a terminal state instead
    res.status(403).json({ error: "Tasks cannot be deleted. History must be preserved." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
