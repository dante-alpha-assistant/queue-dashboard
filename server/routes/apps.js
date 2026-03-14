import { Router } from "express";
import supabase from "../supabase.js";
import { invalidateGithubRepoCache } from "./github.js";
import { createVercelProject } from "../vercel.js";

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

// POST /api/apps/propose-architecture — return AI-proposed repo structure (MUST be before /:id)
appsRouter.post("/propose-architecture", (req, res) => {
  const { name, description } = req.body || {};
  const slug = (name || "my-app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "my-app";

  const desc = (description || "").toLowerCase();

  let result;
  if (/microservice|microservices|distributed|multiple services/.test(desc)) {
    result = {
      type: "multi-service",
      label: "Multi-Service",
      repos: [
        { name: `${slug}-frontend`, role: "Frontend" },
        { name: `${slug}-api`, role: "Backend API" },
        { name: `${slug}-worker`, role: "Background Worker" },
      ],
      reason: "Complex architecture detected — frontend, API, and background worker repos",
    };
  } else if (/frontend|backend|api|rest api|server|client.?side|web app|full.?stack/.test(desc)) {
    result = {
      type: "fullstack",
      label: "Full-Stack",
      repos: [
        { name: `${slug}-frontend`, role: "Frontend" },
        { name: `${slug}-api`, role: "Backend API" },
      ],
      reason: "Full-stack app detected — separate frontend and API repos",
    };
  } else {
    result = {
      type: "monorepo",
      label: "Monorepo",
      repos: [{ name: slug, role: "Monorepo" }],
      reason: "Simple app — single repository",
    };
  }

  res.json(result);
});

// POST /api/apps/suggest-deploy — AI-driven deploy target suggestion (MUST be before /:id)
appsRouter.post("/suggest-deploy", async (req, res) => {
  const { name, description, repos } = req.body || {};
  const repoList = Array.isArray(repos) ? repos : [];

  const NEO_GATEWAY = process.env.NEO_GATEWAY_URL || "http://neo.agents.svc.cluster.local:18789";
  const NEO_TOKEN = process.env.NEO_GATEWAY_TOKEN || "neo-gw-tok-2026";

  // Keyword-based fallback rules engine
  function fallbackSuggest(repoList, description) {
    const desc = (description || "").toLowerCase();
    const isVercelDesc = /\b(react|next\.?js|nextjs|vue|angular|svelte|static site|landing page|frontend|ui|dashboard)\b/.test(desc);
    const isK8sDesc = /\b(api|express|fastapi|django|rails|flask|go|golang|database|backend|worker|ml|machine learning|microservice|grpc|graphql|server)\b/.test(desc);

    return repoList.map(repo => {
      const repoName = (repo.name || "").toLowerCase();
      let deploy_target = "vercel";
      let reasoning = "Default: vercel (user apps deploy to Vercel serverless by default)";

      // Kubernetes ONLY when explicit infra signals detected
      const isK8sWorker = /\b(worker|cron|websocket|queue|message queue|persistent storage|grpc|microservice)\b/.test(desc);

      // Check repo name suffix first (most reliable signal)
      if (/-(frontend|ui|web|client|app)$/.test(repoName)) {
        deploy_target = "vercel";
        reasoning = `Repo name suffix suggests frontend: "${repo.name}" — ideal for Vercel`;
      } else if (/-(worker|service)$/.test(repoName)) {
        deploy_target = "kubernetes";
        reasoning = `Repo name suffix suggests background worker/service: "${repo.name}" — needs Kubernetes`;
      } else if (/-(api|backend|server)$/.test(repoName) && isK8sWorker) {
        deploy_target = "kubernetes";
        reasoning = `Backend repo with infrastructure signals (workers/queues/persistent storage) → Kubernetes`;
      } else if (isVercelDesc || (!isK8sWorker)) {
        deploy_target = "vercel";
        reasoning = "Next.js / frontend app or no strong infra signals — ideal for Vercel deployment";
      } else if (isK8sWorker) {
        deploy_target = "kubernetes";
        reasoning = "Description signals background workers, queues, or persistent storage → Kubernetes";
      }

      return {
        name: repo.name,
        deploy_target,
        namespace: deploy_target === "kubernetes" ? "apps" : null,
        service_name: repo.name,
        reasoning,
      };
    });
  }

  // Try LLM first
  try {
    const userPrompt = `Given this app:
Name: ${name || ""}
Description: ${description || ""}
Repos: ${JSON.stringify(repoList)}

Decide the deploy target for each repo. Options:
- vercel: for frontends, static sites, Next.js apps
- kubernetes: for backends, APIs, workers, databases

Rules:
- DEFAULT is vercel — user apps go to Vercel unless there is a clear infrastructure signal
- Kubernetes ONLY when the app explicitly needs: persistent storage, background workers, WebSocket servers, custom networking, or services that cannot run as serverless functions
- If repo name ends with "-worker", "-service" → kubernetes (background processes)
- If repo name ends with "-api", "-backend", "-server" AND description mentions workers/queues/persistent storage → kubernetes
- If repo name ends with "-frontend", "-ui", "-web", "-client", "-app" → vercel
- Next.js monorepo with API routes → ideal for Vercel deployment (API routes are serverless)
- If description mentions React, Next.js, Vue, Angular, Svelte, static site, landing page → vercel
- If description mentions cron jobs, message queues, WebSockets, persistent storage, background workers → kubernetes
- Full-stack Next.js app → vercel (API routes run as serverless functions)
- User apps go to Vercel. Infrastructure/agents go to Kubernetes.
- Default: vercel

For kubernetes: namespace = "apps", service_name = repo name
For vercel: no namespace (null), service_name = repo name

Return ONLY valid JSON, no explanation:
{ "repos": [{ "name": "repo-name", "deploy_target": "vercel|kubernetes", "namespace": "apps or null", "service_name": "name", "reasoning": "short explanation" }] }`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const llmResp = await fetch(`${NEO_GATEWAY}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NEO_TOKEN}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": "main",
      },
      body: JSON.stringify({
        model: "openclaw:main",
        messages: [
          { role: "system", content: "You are an expert DevOps engineer. Analyze app descriptions and decide deploy targets. Always respond with valid JSON only, no explanation, no markdown." },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (llmResp.ok) {
      const llmData = await llmResp.json();
      const content = llmData?.choices?.[0]?.message?.content || "";
      // Strip possible markdown code blocks
      const cleaned = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && Array.isArray(parsed.repos)) {
        return res.json({ repos: parsed.repos, source: "llm" });
      }
    }
  } catch (e) {
    console.warn("[suggest-deploy] LLM call failed, using fallback:", e.message);
  }

  // Fallback: keyword rules engine
  const fallbackResult = fallbackSuggest(repoList, description);
  res.json({ repos: fallbackResult, source: "fallback" });
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
    const { name, slug, description, repos, repo_source, repo_architecture, supabase_project_ref, deploy_target, deploy_config, env_keys, icon, qa_env_keys, required_credentials, required_qa_credentials } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    if (!slug) return res.status(400).json({ error: "slug required" });

    // Explicit slug uniqueness check (returns a friendly 409 before hitting the DB constraint)
    const { data: existingSlug } = await supabase.from("apps").select("id").eq("slug", slug).maybeSingle();
    if (existingSlug) return res.status(409).json({ error: `Slug "${slug}" is already taken. Please choose a different name or edit the slug.` });

    const validTargets = ["kubernetes", "vercel", "none"];

    // Handle per-repo deploy config (new format) vs legacy string array + single deploy_target
    let reposArray = repos || [];
    let reposConfig = [];
    let primaryDeployTarget = deploy_target || "none";
    let primaryDeployConfig = deploy_config || {};

    if (reposArray.length > 0 && typeof reposArray[0] === "object") {
      // New per-repo format: [{repo, deploy_target, deploy_config}]
      reposConfig = reposArray;
      reposArray = reposArray.map(r => r.repo);
      primaryDeployTarget = reposConfig[0]?.deploy_target || "none";
      primaryDeployConfig = reposConfig[0]?.deploy_config || {};
    } else {
      // Legacy string array format
      reposConfig = reposArray.map(r => ({
        repo: r,
        deploy_target: deploy_target || "none",
        deploy_config: deploy_config || {},
      }));
    }

    if (primaryDeployTarget && !validTargets.includes(primaryDeployTarget)) {
      return res.status(400).json({ error: `Invalid deploy_target "${primaryDeployTarget}". Must be one of: ${validTargets.join(", ")}` });
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
        repos: reposArray,
        repos_config: reposConfig,
        supabase_project_ref: supabase_project_ref || null,
        deploy_target: primaryDeployTarget,
        deploy_config: primaryDeployConfig,
        env_keys: env_keys || [],
        icon: icon || null,
        qa_env_keys: qa_env_keys || [],
        required_credentials: { coding: codingCreds, qa: qaCreds },
        repo_source: repo_source || "scratch",
        repo_architecture: repo_architecture || null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ error: "App with this name or slug already exists" });
      throw error;
    }
    // Invalidate GitHub repo cache — new app may reference a new repo
    invalidateGithubRepoCache();

    // Auto-create Vercel project when deploy_target=vercel
    if (primaryDeployTarget === "vercel") {
      try {
        const vercelToken = process.env.VERCEL_TOKEN;
        if (vercelToken) {
          // Use the first repo in the array, or derive from slug
          const firstRepo = reposArray[0] || `dante-alpha-assistant/${slug}`;
          const repoFullName = firstRepo.includes("/")
            ? firstRepo
            : `dante-alpha-assistant/${firstRepo}`;

          const vercelResult = await createVercelProject({
            slug,
            repoFullName,
            envKeys: env_keys || [],
            vercelToken,
          });

          // Persist vercel_project_id and preview URL into the app record
          await supabase
            .from("apps")
            .update({
              vercel_project_id: vercelResult.id,
              vercel_preview_url: vercelResult.previewUrl,
            })
            .eq("id", data.id);

          // Enrich the response object
          data.vercel_project_id = vercelResult.id;
          data.vercel_preview_url = vercelResult.previewUrl;
        } else {
          console.warn("[Vercel] VERCEL_TOKEN not set — skipping auto-project creation");
        }
      } catch (vercelErr) {
        // Non-fatal: log and attach a warning but don't fail app creation
        console.error("[Vercel] Failed to auto-create project:", vercelErr.message);
        data.vercel_warning = vercelErr.message;
      }
    }

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
