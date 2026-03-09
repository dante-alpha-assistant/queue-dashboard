import { Router } from "express";
import supabase from "../supabase.js";

export const agentsRouter = Router();

// List + filter
agentsRouter.get("/", async (req, res) => {
  try {
    const { status, capability, task_type, tier } = req.query;
    let query = supabase.from("agent_cards").select("*").order("name");
    if (status) query = query.eq("status", status);
    else query = query.neq("status", "disabled");
    if (capability) query = query.contains("capabilities", [capability]);
    if (task_type) query = query.contains("task_types", [task_type]);
    if (tier) query = query.eq("tier", tier);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Live status: active tasks per agent (lightweight, no kubectl)
agentsRouter.get("/live-status", async (req, res) => {
  try {
    const { data: tasks, error } = await supabase
      .from("agent_tasks")
      .select("id, title, status, type, priority, assigned_agent, started_at, updated_at")
      .in("status", ["in_progress", "qa_testing"])
      .order("updated_at", { ascending: false });
    if (error) throw error;

    // Group by assigned_agent
    const byAgent = {};
    for (const t of (tasks || [])) {
      const agent = t.assigned_agent;
      if (!agent) continue;
      if (!byAgent[agent]) byAgent[agent] = [];
      byAgent[agent].push(t);
    }
    res.json(byAgent);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Pipeline stats — task flow between agents
agentsRouter.get("/pipeline-stats", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    // Get completed/deployed tasks with timing data
    const { data: tasks, error } = await supabase
      .from("agent_tasks")
      .select("id, title, status, type, priority, assigned_agent, qa_agent, created_at, started_at, completed_at, updated_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (error) throw error;

    // Get activity log for status transitions
    const { data: activity } = await supabase
      .from("task_activity_log")
      .select("task_id, field, old_value, new_value, changed_at")
      .eq("field", "status")
      .gte("changed_at", since)
      .order("changed_at", { ascending: true });

    // Build per-task timeline from activity log
    const taskTimelines = {};
    for (const a of (activity || [])) {
      if (!taskTimelines[a.task_id]) taskTimelines[a.task_id] = [];
      taskTimelines[a.task_id].push(a);
    }

    // Compute stage durations
    const stageDurations = { coding: [], qa: [], end_to_end: [] };
    const agentStats = {}; // agent -> { coding_tasks, qa_tasks, avg_coding_time, avg_qa_time }

    for (const t of (tasks || [])) {
      const timeline = taskTimelines[t.id] || [];

      // Find coding duration: in_progress -> qa_testing
      const startCoding = timeline.find(a => a.new_value === "in_progress");
      const startQa = timeline.find(a => a.new_value === "qa_testing");
      const completed = timeline.find(a => a.new_value === "completed" || a.new_value === "deployed");

      if (startCoding && startQa) {
        const codingMs = new Date(startQa.changed_at) - new Date(startCoding.changed_at);
        if (codingMs > 0) stageDurations.coding.push(codingMs);

        // Track per-agent coding stats
        if (t.assigned_agent) {
          if (!agentStats[t.assigned_agent]) agentStats[t.assigned_agent] = { coding_tasks: 0, qa_tasks: 0, coding_times: [], qa_times: [] };
          agentStats[t.assigned_agent].coding_tasks++;
          agentStats[t.assigned_agent].coding_times.push(codingMs);
        }
      }

      if (startQa && completed) {
        const qaMs = new Date(completed.changed_at) - new Date(startQa.changed_at);
        if (qaMs > 0) stageDurations.qa.push(qaMs);

        // Track per-agent QA stats
        if (t.qa_agent) {
          if (!agentStats[t.qa_agent]) agentStats[t.qa_agent] = { coding_tasks: 0, qa_tasks: 0, coding_times: [], qa_times: [] };
          agentStats[t.qa_agent].qa_tasks++;
          agentStats[t.qa_agent].qa_times.push(qaMs);
        }
      }

      if (startCoding && completed) {
        const e2eMs = new Date(completed.changed_at) - new Date(startCoding.changed_at);
        if (e2eMs > 0) stageDurations.end_to_end.push(e2eMs);
      }
    }

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    const median = arr => {
      if (!arr.length) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    };

    // Current pipeline state
    const pipelineState = {
      todo: (tasks || []).filter(t => t.status === "todo").length,
      in_progress: (tasks || []).filter(t => t.status === "in_progress").length,
      qa_testing: (tasks || []).filter(t => t.status === "qa_testing").length,
      completed: (tasks || []).filter(t => t.status === "completed").length,
      deployed: (tasks || []).filter(t => t.status === "deployed").length,
      blocked: (tasks || []).filter(t => t.status === "blocked").length,
      failed: (tasks || []).filter(t => t.status === "failed").length,
    };

    // Current tasks per stage (for live view)
    const currentByStage = {
      todo: (tasks || []).filter(t => t.status === "todo").slice(0, 10).map(t => ({ id: t.id, title: t.title, priority: t.priority, agent: t.assigned_agent })),
      in_progress: (tasks || []).filter(t => t.status === "in_progress").map(t => ({ id: t.id, title: t.title, priority: t.priority, agent: t.assigned_agent })),
      qa_testing: (tasks || []).filter(t => t.status === "qa_testing").map(t => ({ id: t.id, title: t.title, priority: t.priority, agent: t.assigned_agent, qa_agent: t.qa_agent })),
      blocked: (tasks || []).filter(t => t.status === "blocked").map(t => ({ id: t.id, title: t.title, priority: t.priority, agent: t.assigned_agent })),
    };

    // Get agents with capacity info
    const { data: agents } = await supabase
      .from("agent_cards")
      .select("id, name, capabilities, max_capacity, current_load, status")
      .neq("status", "disabled");

    // Identify bottlenecks
    const bottlenecks = [];
    const qaAgents = (agents || []).filter(a => (a.capabilities || []).includes("qa"));
    const totalQaSlots = qaAgents.reduce((sum, a) => sum + (a.max_capacity || 1), 0);
    if (pipelineState.qa_testing > totalQaSlots) {
      bottlenecks.push({ stage: "qa_testing", severity: "high", message: `QA queue (${pipelineState.qa_testing}) exceeds capacity (${totalQaSlots} slots)` });
    } else if (pipelineState.qa_testing > 0 && pipelineState.qa_testing >= totalQaSlots) {
      bottlenecks.push({ stage: "qa_testing", severity: "medium", message: `QA queue at capacity (${pipelineState.qa_testing}/${totalQaSlots})` });
    }
    if (pipelineState.blocked > 2) {
      bottlenecks.push({ stage: "blocked", severity: "high", message: `${pipelineState.blocked} tasks blocked` });
    }
    if (pipelineState.todo > 10) {
      bottlenecks.push({ stage: "todo", severity: "medium", message: `${pipelineState.todo} tasks waiting in backlog` });
    }

    // Per-agent summary
    const agentSummary = {};
    for (const [agent, stats] of Object.entries(agentStats)) {
      agentSummary[agent] = {
        coding_tasks: stats.coding_tasks,
        qa_tasks: stats.qa_tasks,
        avg_coding_ms: avg(stats.coding_times),
        avg_qa_ms: avg(stats.qa_times),
      };
    }

    res.json({
      period_days: days,
      pipeline_state: pipelineState,
      current_by_stage: currentByStage,
      stage_durations: {
        coding: { avg_ms: avg(stageDurations.coding), median_ms: median(stageDurations.coding), count: stageDurations.coding.length },
        qa: { avg_ms: avg(stageDurations.qa), median_ms: median(stageDurations.qa), count: stageDurations.qa.length },
        end_to_end: { avg_ms: avg(stageDurations.end_to_end), median_ms: median(stageDurations.end_to_end), count: stageDurations.end_to_end.length },
      },
      agent_summary: agentSummary,
      bottlenecks,
      agents: (agents || []).map(a => ({
        id: a.id,
        name: a.name,
        capabilities: a.capabilities,
        max_capacity: a.max_capacity,
        current_load: a.current_load,
        status: a.status,
      })),
    });
// Hierarchy tree — MUST be before /:name
agentsRouter.get("/hierarchy", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("agent_cards")
      .select("id, name, parent_agent, status, capabilities, current_load, avatar, emoji, description, role, tier, max_capacity, metrics")
      .order("name");
    if (error) throw error;

    const agents = data || [];
    const byId = {};
    agents.forEach(a => { byId[a.id] = { ...a, children: [] }; });

    const roots = [];
    agents.forEach(a => {
      if (a.parent_agent && byId[a.parent_agent]) {
        byId[a.parent_agent].children.push(byId[a.id]);
      } else {
        roots.push(byId[a.id]);
      }
    });

    if (roots.length === 1) {
      res.json({ tree: roots[0] });
    } else {
      res.json({
        tree: {
          id: "_root",
          name: "Organization",
          role: "Virtual Root",
          status: "online",
          capabilities: [],
          current_load: 0,
          avatar: null,
          emoji: "🏢",
          children: roots,
        },
      });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// A2A discovery — MUST be before /:name
agentsRouter.get("/discover", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("agent_cards")
      .select("id, name, capabilities, skills, status, endpoint_url, task_types, max_capacity, current_load, avatar")
      .neq("status", "disabled")
      .order("name");
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });

// Hierarchy tree for org chart (Pingboard)
agentsRouter.get("/hierarchy", async (_req, res) => {
  try {
    const { data: agents, error } = await supabase
      .from("agent_cards")
      .select("id, name, status, capabilities, tier, role, parent_agent, avatar, current_load, max_capacity, last_heartbeat, metadata, emoji")
      .order("name");
    if (error) throw error;

    // Build Dante (human) as root node
    const dante = {
      id: "dante",
      name: "Dante",
      tier: "owner",
      role: "Owner / CEO",
      status: "online",
      avatar: null,
      is_human: true,
      children: [],
    };

    // Index agents by id
    const byId = {};
    for (const a of agents) {
      byId[a.id] = { ...a, children: [] };
    }

    // Build tree: agents with no parent_agent report to Dante
    for (const a of agents) {
      const node = byId[a.id];
      if (a.parent_agent && byId[a.parent_agent]) {
        byId[a.parent_agent].children.push(node);
      } else {
        // Top-level agent reports to Dante
        dante.children.push(node);
      }
    }

    res.json(dante);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
  }
});

// Bulk pod replicas for all agents (K8s) — used by org chart view
agentsRouter.get("/all-replicas", async (req, res) => {
  try {
    const { execSync } = await import("child_process");
    const kubectl = process.env.KUBECTL_PATH || "/tools/kubectl";
    const namespace = process.env.K8S_NAMESPACE || "agents";

    // Get all agents
    const { data: agents } = await supabase
      .from("agent_cards")
      .select("id, name")
      .order("name");

    // Get all pods in the agents namespace
    let allPods = [];
    try {
      const raw = execSync(
        `${kubectl} get pods -n ${namespace} -o json`,
        { timeout: 15000, encoding: "utf8" }
      );
      const parsed = JSON.parse(raw);
      allPods = parsed.items || [];
    } catch (e) {
      allPods = [];
    }

    // Get all in-progress tasks
    const { data: tasks } = await supabase
      .from("agent_tasks")
      .select("id, title, status, type, priority, assigned_agent")
      .in("status", ["in_progress", "assigned", "qa_testing"])
      .order("created_at", { ascending: false });

    // Group pods by agent (match via app label)
    const result = {};
    for (const agent of (agents || [])) {
      const agentPods = allPods.filter(pod => {
        const appLabel = pod.metadata?.labels?.app;
        return appLabel === agent.id || appLabel === agent.name;
      });

      result[agent.id] = {
        agent: agent.id,
        pods: agentPods.map((pod) => {
          const containerStatuses = pod.status?.containerStatuses || [];
          const mainContainer = containerStatuses[0] || {};
          const startedAt = mainContainer.state?.running?.startedAt;
          const ready = mainContainer.ready || false;
          const restarts = mainContainer.restartCount || 0;
          const container = (pod.spec?.containers || [])[0] || {};
          const resources = container.resources || {};
          return {
            name: pod.metadata?.name,
            node: pod.spec?.nodeName,
            status: pod.status?.phase,
            ready,
            restarts,
            startedAt,
            uptime: startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) : null,
            resources: { requests: resources.requests || {}, limits: resources.limits || {} },
            image: container.image,
          };
        }),
        activeTasks: (tasks || []).filter(t => t.assigned_agent === agent.id),
      };
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Pod replicas for an agent (K8s)
agentsRouter.get("/:name/replicas", async (req, res) => {
  try {
    const agentName = req.params.name;
    const { execSync } = await import("child_process");
    const kubectl = process.env.KUBECTL_PATH || "/tools/kubectl";
    const namespace = process.env.K8S_NAMESPACE || "agents";

    let pods = [];
    try {
      const raw = execSync(
        `${kubectl} get pods -n ${namespace} -l app=${agentName} -o json`,
        { timeout: 10000, encoding: "utf8" }
      );
      const parsed = JSON.parse(raw);
      pods = (parsed.items || []).map((pod) => {
        const containerStatuses = pod.status?.containerStatuses || [];
        const mainContainer = containerStatuses[0] || {};
        const startedAt = mainContainer.state?.running?.startedAt;
        const ready = mainContainer.ready || false;
        const restarts = mainContainer.restartCount || 0;

        // Resource usage — try to get from resources requests/limits
        const container = (pod.spec?.containers || [])[0] || {};
        const resources = container.resources || {};

        return {
          name: pod.metadata?.name,
          node: pod.spec?.nodeName,
          status: pod.status?.phase,
          ready,
          restarts,
          startedAt,
          uptime: startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) : null,
          resources: {
            requests: resources.requests || {},
            limits: resources.limits || {},
          },
          image: container.image,
        };
      });
    } catch (e) {
      // kubectl failed — agent might not be K8s-deployed
      pods = [];
    }

    // Also get current tasks for this agent
    const { data: tasks } = await supabase
      .from("agent_tasks")
      .select("id, title, status, type, priority")
      .eq("assigned_agent", agentName)
      .in("status", ["in_progress", "assigned", "qa_testing"])
      .order("created_at", { ascending: false })
      .limit(10);

    res.json({ agent: agentName, pods, activeTasks: tasks || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Full card + recent tasks
agentsRouter.get("/:name", async (req, res) => {
  try {
    const { data: agent, error } = await supabase
      .from("agent_cards")
      .select("*")
      .eq("id", req.params.name)
      .single();
    if (error) return res.status(404).json({ error: "Agent not found" });
    const { data: tasks } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("assigned_agent", req.params.name)
      .order("created_at", { ascending: false })
      .limit(20);
    res.json({ ...agent, recent_tasks: tasks || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update allowed fields only
agentsRouter.patch("/:name", async (req, res) => {
  try {
    const allowed = ["status", "current_load", "current_tasks", "last_heartbeat", "metrics", "metadata", "max_capacity", "description", "disabled_at", "disabled_by", "parent_agent", "tier", "role", "avatar"];
    const updates = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Guard disabled status: cannot change disabled → other status without force_reenable
    if (updates.status && updates.status !== 'disabled') {
      const { data: current } = await supabase
        .from("agent_cards")
        .select("status, disabled_at, disabled_by")
        .eq("id", req.params.name)
        .single();
      if (current?.status === 'disabled' && !req.body.force_reenable) {
        return res.status(409).json({
          error: "Agent is disabled. Set force_reenable: true to re-enable.",
          disabled_at: current.disabled_at,
          disabled_by: current.disabled_by,
        });
      }
      // Re-enabling: clear disabled fields
      if (current?.status === 'disabled' && req.body.force_reenable) {
        updates.disabled_at = null;
        updates.disabled_by = null;
      }
    }

    // Auto-set disabled metadata when disabling
    if (updates.status === 'disabled') {
      updates.disabled_at = new Date().toISOString();
      updates.disabled_by = req.body.disabled_by || 'api';
    }

    const { data, error } = await supabase
      .from("agent_cards")
      .update(updates)
      .eq("id", req.params.name)
      .select()
      .single();
    if (error) return res.status(404).json({ error: "Agent not found" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
