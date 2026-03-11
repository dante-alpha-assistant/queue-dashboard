import { Router } from "express";
import supabase from "../supabase.js";
import { invalidateGithubRepoCache } from "./github.js";

export const appsRouter = Router();

// Transform app row: expand required_credentials jsonb into separate fields
function expandCredentials(app) {
  if (!app) return app;
  const creds = app.required_credentials || {};
  return {
    ...app,
    required_credentials: creds.coding || [],
    required_qa_credentials: creds.qa || [],
  };
}

// GET /api/apps — list all apps (optionally filter by status)
appsRouter.get("/", async (req, res) => {
  try {
    const status = req.query.status || "active";
    let query = supabase.from("apps").select("*").order("name");
    if (status !== "all") {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json((data || []).map(expandCredentials));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/apps/stats/bulk — bulk task stats for all apps (MUST be before /:id)
appsRouter.get("/stats/bulk", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("agent_tasks")
      .select("app_id, status, updated_at")
      .not("app_id", "is", null)
      .neq("status", "deprecated");
    if (error) throw error;

    const stats = {};
    for (const task of data || []) {
      if (!task.app_id) continue;
      if (!stats[task.app_id]) stats[task.app_id] = { total: 0, active: 0, completed: 0, failed: 0, deployed: 0, last_activity: null };
      const s = stats[task.app_id];
      s.total++;
      if (["todo", "assigned", "in_progress", "blocked", "qa_testing"].includes(task.status)) s.active++;
      if (task.status === "completed") s.completed++;
      if (task.status === "failed") s.failed++;
      if (task.status === "deployed") s.deployed++;
      if (!s.last_activity || task.updated_at > s.last_activity) s.last_activity = task.updated_at;
    }
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/apps/:id — get single app by id or slug
appsRouter.get("/:id", async (req, res) => {
  try {
    const identifier = req.params.id;
    // Try UUID first, then slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const column = isUuid ? "id" : "slug";
    const { data, error } = await supabase
      .from("apps")
      .select("*")
      .eq(column, identifier)
      .single();
    if (error) return res.status(404).json({ error: "App not found" });
    res.json(expandCredentials(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/apps — create app
appsRouter.post("/", async (req, res) => {
  try {
    const { name, slug, description, repos, supabase_project_ref, deploy_target, deploy_config, env_keys, icon, qa_env_keys, required_credentials, required_qa_credentials } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    if (!slug) return res.status(400).json({ error: "slug required" });

    const validTargets = ["kubernetes", "vercel", "none"];
    if (deploy_target && !validTargets.includes(deploy_target)) {
      return res.status(400).json({ error: `Invalid deploy_target "${deploy_target}". Must be one of: ${validTargets.join(", ")}` });
    }

    // Build required_credentials jsonb from separate coding/qa arrays
    const codingCreds = required_credentials || ["GH_TOKEN"];
    const qaCreds = required_qa_credentials || ["GH_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"];

    const { data, error } = await supabase
      .from("apps")
      .insert({
        name,
        slug,
        description: description || null,
        repos: repos || [],
        supabase_project_ref: supabase_project_ref || null,
        deploy_target: deploy_target || "none",
        deploy_config: deploy_config || {},
        env_keys: env_keys || [],
        icon: icon || null,
        qa_env_keys: qa_env_keys || [],
        required_credentials: { coding: codingCreds, qa: qaCreds },
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ error: "App with this name or slug already exists" });
      throw error;
    }
    // Invalidate GitHub repo cache — new app may reference a new repo
    invalidateGithubRepoCache();
    res.status(201).json(expandCredentials(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/apps/:id — update app
appsRouter.patch("/:id", async (req, res) => {
  try {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    // Don't allow changing id
    delete updates.id;
    delete updates.created_at;

    // Merge required_credentials / required_qa_credentials into jsonb column
    if (updates.required_credentials || updates.required_qa_credentials) {
      // Fetch current to merge
      const { data: current } = await supabase.from("apps").select("required_credentials").eq("id", req.params.id).single();
      const existing = current?.required_credentials || { coding: [], qa: [] };
      updates.required_credentials = {
        coding: updates.required_credentials || existing.coding || [],
        qa: updates.required_qa_credentials || existing.qa || [],
      };
      delete updates.required_qa_credentials;
    }

    if (updates.deploy_target) {
      const validTargets = ["kubernetes", "vercel", "none"];
      if (!validTargets.includes(updates.deploy_target)) {
        return res.status(400).json({ error: `Invalid deploy_target "${updates.deploy_target}". Must be one of: ${validTargets.join(", ")}` });
      }
    }

    const { data, error } = await supabase
      .from("apps")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") return res.status(404).json({ error: "App not found" });
      throw error;
    }
    res.json(expandCredentials(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/apps/:id — archive (soft delete)
appsRouter.delete("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("apps")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") return res.status(404).json({ error: "App not found" });
      throw error;
    }
    res.json({ ok: true, app: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/apps/:id/stats — task stats for a single app
appsRouter.get("/:id/stats", async (req, res) => {
  try {
    const appId = req.params.id;
    const { data, error } = await supabase
      .from("agent_tasks")
      .select("status, updated_at")
      .eq("app_id", appId)
      .neq("status", "deprecated");
    if (error) throw error;

    const result = { total: 0, active: 0, completed: 0, failed: 0, deployed: 0, last_activity: null };
    for (const task of data || []) {
      result.total++;
      if (["todo", "assigned", "in_progress", "blocked", "qa_testing"].includes(task.status)) result.active++;
      if (task.status === "completed") result.completed++;
      if (task.status === "failed") result.failed++;
      if (task.status === "deployed") result.deployed++;
      if (!result.last_activity || task.updated_at > result.last_activity) result.last_activity = task.updated_at;
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/apps/:id/tasks — list tasks for an app
appsRouter.get("/:id/tasks", async (req, res) => {
  try {
    const identifier = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    let appId = identifier;
    if (!isUuid) {
      // Resolve slug to id
      const { data: app, error: appErr } = await supabase
        .from("apps")
        .select("id")
        .eq("slug", identifier)
        .single();
      if (appErr || !app) return res.status(404).json({ error: "App not found" });
      appId = app.id;
    }

    let query = supabase
      .from("agent_tasks")
      .select("id, title, status, type, priority, assigned_agent, created_at, updated_at, pull_request_url, app_id")
      .eq("app_id", appId)
      .neq("status", "deprecated")
      .order("created_at", { ascending: false });

    if (req.query.status) {
      query = query.eq("status", req.query.status);
    }
    if (req.query.limit) {
      query = query.limit(parseInt(req.query.limit));
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
