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
      .eq("status", "online")
      .order("name");
    if (error) throw error;
    res.json(data);
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
