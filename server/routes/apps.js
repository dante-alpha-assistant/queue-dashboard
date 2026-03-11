import { Router } from "express";
import supabase from "../supabase.js";

export const appsRouter = Router();

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
    res.json(data);
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
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/apps — create app
appsRouter.post("/", async (req, res) => {
  try {
    const { name, slug, description, repos, supabase_project_ref, deploy_target, deploy_config, env_keys, icon } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    if (!slug) return res.status(400).json({ error: "slug required" });

    const validTargets = ["kubernetes", "vercel", "none"];
    if (deploy_target && !validTargets.includes(deploy_target)) {
      return res.status(400).json({ error: `Invalid deploy_target "${deploy_target}". Must be one of: ${validTargets.join(", ")}` });
    }

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
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ error: "App with this name or slug already exists" });
      throw error;
    }
    res.status(201).json(data);
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
    res.json(data);
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
