import { Router } from "express";
import supabase from "../supabase.js";

export const healthRouter = Router();

healthRouter.get("/", async (req, res) => {
  try {
    const now = new Date();
    const h24ago = new Date(now - 24 * 3600 * 1000).toISOString();

    // Fetch all non-deployed/non-completed recent tasks + agents in parallel
    const [tasksRes, agentsRes, failedRes] = await Promise.all([
      supabase
        .from("agent_tasks")
        .select("id, title, status, type, priority, assigned_agent, created_at, started_at, updated_at, completed_at, pull_request_url, error, blocked_reason")
        .in("status", ["todo", "in_progress", "assigned", "qa_testing", "completed", "blocked", "deploying"])
        .order("updated_at", { ascending: false }),
      supabase
        .from("agent_cards")
        .select("id, name, status, capabilities, current_load, max_capacity, last_heartbeat, metadata")
        .order("name"),
      supabase
        .from("agent_tasks")
        .select("id, title, status, error, updated_at, assigned_agent")
        .eq("status", "failed")
        .gte("updated_at", h24ago)
        .order("updated_at", { ascending: false }),
    ]);

    if (tasksRes.error) throw tasksRes.error;
    if (agentsRes.error) throw agentsRes.error;

    const tasks = tasksRes.data || [];
    const agents = agentsRes.data || [];
    const failedTasks = failedRes.data || [];

    // === Stuck Tasks ===
    const stuckTasks = [];
    for (const t of tasks) {
      const updatedAt = new Date(t.updated_at || t.created_at);
      const minutesInStatus = (now - updatedAt) / 60000;

      if (t.status === "in_progress" && minutesInStatus > 30) {
        stuckTasks.push({ ...t, minutes_in_status: Math.round(minutesInStatus), stuck_reason: "in_progress > 30 min" });
      } else if (t.status === "assigned" && minutesInStatus > 30) {
        stuckTasks.push({ ...t, minutes_in_status: Math.round(minutesInStatus), stuck_reason: "assigned > 30 min" });
      } else if (t.status === "qa_testing" && minutesInStatus > 15) {
        stuckTasks.push({ ...t, minutes_in_status: Math.round(minutesInStatus), stuck_reason: "qa_testing > 15 min" });
      } else if (t.status === "completed" && minutesInStatus > 60) {
        stuckTasks.push({ ...t, minutes_in_status: Math.round(minutesInStatus), stuck_reason: "completed but not merged > 1 hour" });
      } else if (t.status === "deploying" && minutesInStatus > 15) {
        stuckTasks.push({ ...t, minutes_in_status: Math.round(minutesInStatus), stuck_reason: "deploying > 15 min" });
      }
    }

    // Todo tasks with no available agent
    const onlineAgents = agents.filter(a => a.status === "online");
    const todoTasks = tasks.filter(t => t.status === "todo");
    if (todoTasks.length > 0 && onlineAgents.length === 0) {
      for (const t of todoTasks) {
        stuckTasks.push({ ...t, minutes_in_status: Math.round((now - new Date(t.updated_at || t.created_at)) / 60000), stuck_reason: "todo with no online agent" });
      }
    }

    // === Agent Health ===
    const agentHealth = agents.filter(a => a.status !== "disabled").map(a => {
      const activeTasks = tasks.filter(t => t.assigned_agent === a.id && ["in_progress", "assigned", "qa_testing"].includes(t.status));
      const lastHb = a.last_heartbeat ? new Date(a.last_heartbeat) : null;
      const hbAgeMin = lastHb ? Math.round((now - lastHb) / 60000) : null;
      return {
        id: a.id,
        name: a.name,
        status: a.status,
        capabilities: a.capabilities,
        current_load: a.current_load,
        max_capacity: a.max_capacity,
        last_heartbeat: a.last_heartbeat,
        heartbeat_age_min: hbAgeMin,
        heartbeat_stale: hbAgeMin !== null && hbAgeMin > 10,
        active_tasks: activeTasks.map(t => ({ id: t.id, title: t.title, status: t.status, started_at: t.started_at })),
        model_health: a.metadata?.model_health || null,
        model_health_at: a.metadata?.model_health_at || null,
      };
    });

    // === Merge Queue (tasks completed with PRs, not yet deployed) ===
    const mergeQueue = tasks
      .filter(t => t.status === "completed" && t.pull_request_url)
      .map(t => {
        const prUrls = Array.isArray(t.pull_request_url) ? t.pull_request_url : [t.pull_request_url];
        const repos = prUrls.map(url => {
          const match = url.match(/github\.com\/([^/]+\/[^/]+)\//);
          return match ? match[1] : "unknown";
        });
        return { id: t.id, title: t.title, pull_request_url: t.pull_request_url, repos, completed_at: t.completed_at, updated_at: t.updated_at };
      });

    // Group merge queue by repo
    const mergeByRepo = {};
    for (const item of mergeQueue) {
      for (const repo of item.repos) {
        if (!mergeByRepo[repo]) mergeByRepo[repo] = [];
        mergeByRepo[repo].push(item);
      }
    }

    // === Health Score ===
    const onlineCount = onlineAgents.length;
    const totalNonDisabled = agents.filter(a => a.status !== "disabled").length;
    const staleHeartbeats = agentHealth.filter(a => a.heartbeat_stale).length;

    let score = 100;
    // Deduct for stuck tasks
    score -= Math.min(stuckTasks.length * 10, 40);
    // Deduct for failed tasks in 24h
    score -= Math.min(failedTasks.length * 5, 20);
    // Deduct for offline agents
    if (totalNonDisabled > 0) {
      const offlineRatio = 1 - (onlineCount / totalNonDisabled);
      score -= Math.round(offlineRatio * 20);
    }
    // Deduct for stale heartbeats
    score -= Math.min(staleHeartbeats * 5, 15);
    // Deduct for blocked tasks
    const blockedCount = tasks.filter(t => t.status === "blocked").length;
    score -= Math.min(blockedCount * 5, 15);

    score = Math.max(0, Math.min(100, score));

    const level = score >= 80 ? "green" : score >= 50 ? "yellow" : "red";

    res.json({
      health_score: score,
      health_level: level,
      stuck_tasks: stuckTasks,
      failed_24h: failedTasks,
      agent_health: agentHealth,
      merge_queue: mergeByRepo,
      merge_queue_total: mergeQueue.length,
      blocked_count: blockedCount,
      summary: {
        online_agents: onlineCount,
        total_agents: totalNonDisabled,
        stuck_count: stuckTasks.length,
        failed_24h_count: failedTasks.length,
        merge_pending: mergeQueue.length,
      },
      generated_at: now.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
