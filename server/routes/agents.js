import { Router } from "express";
import supabase from "../supabase.js";

export const agentsRouter = Router();

// List + filter
agentsRouter.get("/", async (req, res) => {
  try {
    const { status, capability, task_type, tier } = req.query;
    let query = supabase.from("agent_cards").select("*").order("name");
    if (status) query = query.eq("status", status);
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
    const allowed = ["status", "current_load", "current_tasks", "last_heartbeat", "metrics", "metadata", "max_capacity", "description", "disabled_at", "disabled_by"];
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
