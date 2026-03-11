import { Router } from "express";
import supabase from "../supabase.js";

export const router = Router();

// --- Counts by time period (cached 30s in-memory) ---
const _countsCacheMap = {};

router.get("/tasks/counts-by-period", async (req, res) => {
  try {
    const now = Date.now();
    const projectId = req.query.project_id || "all";
    const cached = _countsCacheMap[projectId];
    if (cached && cached.expires > now) {
      return res.json(cached.data);
    }

    const nowDate = new Date();
    const todayStart = new Date(nowDate);
    todayStart.setHours(0, 0, 0, 0);

    const periods = {
      today: todayStart.toISOString(),
      last_24h: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      last_7d: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_30d: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const ALWAYS_INCLUDE_STATUSES = ["todo", "in_progress", "qa_testing", "blocked"];

    const buildQuery = (since) => {
      let q = supabase.from("agent_tasks").select("id", { count: "exact", head: true }).neq("status", "deprecated");
      if (projectId !== "all") q = q.eq("project_id", projectId);
      if (since) {
        q = q.or(`created_at.gte.${since},status.in.(${ALWAYS_INCLUDE_STATUSES.join(",")})`);
      }
      return q;
    };

    const [todayRes, h24Res, d7Res, d30Res, allRes] = await Promise.all([
      buildQuery(periods.today),
      buildQuery(periods.last_24h),
      buildQuery(periods.last_7d),
      buildQuery(periods.last_30d),
      buildQuery(null),
    ]);

    const counts = {
      today: todayRes.count ?? 0,
      last_24h: h24Res.count ?? 0,
      last_7d: d7Res.count ?? 0,
      last_30d: d30Res.count ?? 0,
      all: allRes.count ?? 0,
    };

    _countsCacheMap[projectId] = { data: counts, expires: now + 30_000 };
    res.json(counts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
    const stats = { todo: 0, in_progress: 0, qa_testing: 0, completed: 0, failed: 0, deployed: 0, blocked: 0, deploying: 0, deploy_failed: 0 };
    data.forEach((t) => { if (t.status !== "deprecated" && stats[t.status] !== undefined) stats[t.status]++; });
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// All tasks (optimized with server-side filtering)
router.get("/tasks", async (req, res) => {
  try {
    // Light mode: exclude heavy columns (description, result, qa_result, metadata) for list view
    const isLight = req.query.columns === "light";
    const selectCols = isLight
      ? "id,title,status,type,priority,assigned_agent,created_at,updated_at,error,deploy_target,pull_request_url,deployment_url,started_at,completed_at,paused,blocked_reason,stage,repository_url,project_id,repository_id,project:agent_projects(id,name,slug),repository:agent_repositories(id,name,url,provider)"
      : "*, project:agent_projects(id, name, slug), repository:agent_repositories(id, name, url, provider)";

    let query = supabase
      .from("agent_tasks")
      .select(selectCols)
      .order("created_at", { ascending: false });
    if (req.query.project_id) query = query.eq("project_id", req.query.project_id);
    if (req.query.repository_id) query = query.eq("repository_id", req.query.repository_id);
    // Hide deprecated tasks by default (soft-deleted); include with ?include_deprecated=true
    if (req.query.include_deprecated !== "true") {
      query = query.neq("status", "deprecated");
    }

    // Text search by title (case-insensitive partial match)
    if (req.query.search) {
      query = query.ilike("title", `%${req.query.search}%`);
      query = query.limit(10);
    }

    const { since, until } = req.query;
    const ALWAYS_INCLUDE_STATUSES = ["todo", "in_progress", "qa_testing", "blocked"];

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
    const validPriorities = ["low", "normal", "high", "urgent"];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority "${priority}". Must be one of: ${validPriorities.join(", ")}` });
    }
    const validTypes = ["coding", "ops", "general", "review", "research", "qa"];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type "${type}". Must be one of: ${validTypes.join(", ")}` });
    }

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

// Single task (full data including description, result, qa_result, metadata)
router.get("/tasks/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("agent_tasks")
      .select("*, project:agent_projects(id, name, slug), repository:agent_repositories(id, name, url, provider)")
      .eq("id", req.params.id)
      .single();
    if (error) return res.status(404).json({ error: "Task not found" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/tasks/:id", async (req, res) => {
  try {
    const updates = { ...req.body, updated_at: new Date().toISOString() };

    // === STATUS REGRESSION GUARD ===
    // Block completed/deployed → todo/in_progress transitions via API
    // These can only happen through the reopen_task RPC (dashboard UI)
    if (updates.status === "todo" || updates.status === "in_progress") {
      const { data: current } = await supabase
        .from("agent_tasks")
        .select("status")
        .eq("id", req.params.id)
        .single();
      if (current && (current.status === "completed" || current.status === "deployed")) {
        return res.status(403).json({
          error: `Status regression blocked: ${current.status} → ${updates.status}. Use the Reopen button in the dashboard to reopen completed/deployed tasks.`,
        });
      }
    }

    if (updates.status === "done" || updates.status === "failed") {
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
    // When resuming (paused: false), don't auto-clear other fields
    // When pausing, the client sends { status: todo, assigned_agent: null, started_at: null, paused: true }

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

// Force status change (bypasses regression guard, logs activity)
router.post("/tasks/:id/force-status", async (req, res) => {
  try {
    const { status, changed_by } = req.body;
    const VALID_STATUSES = ["todo", "in_progress", "qa_testing", "completed", "blocked", "deployed", "failed"];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    // Get current status for activity log
    const { data: current, error: fetchErr } = await supabase
      .from("agent_tasks")
      .select("status")
      .eq("id", req.params.id)
      .single();
    if (fetchErr) throw fetchErr;

    const updates = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "completed" || status === "failed" || status === "deployed") {
      updates.completed_at = new Date().toISOString();
    }
    if (status === "todo") {
      updates.started_at = null;
      updates.completed_at = null;
      updates.error = null;
      updates.blocked_reason = null;
    }

    const { data, error } = await supabase
      .from("agent_tasks")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;

    // Log the manual override in activity log
    await supabase.from("task_activity_log").insert({
      task_id: req.params.id,
      field: "force_status",
      old_value: current.status,
      new_value: `${status} (manual override by ${changed_by || "dashboard"})`,
      changed_by: changed_by || "dashboard",
      changed_at: new Date().toISOString(),
    }).catch(() => {});

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SSE proxy — stream events from task-dispatcher
router.get("/events", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Keep-alive
  const keepAlive = setInterval(() => {
    try { res.write(":keepalive\n\n"); } catch {}
  }, 15000);

  let upstream;
  try {
    const upstreamUrl = `${DISPATCHER_URL.replace('/api', '')}/events`;
    const controller = new AbortController();
    const upstreamResp = await fetch(upstreamUrl, {
      headers: { "Accept": "text/event-stream" },
      signal: controller.signal,
    });

    if (!upstreamResp.ok || !upstreamResp.body) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Cannot connect to dispatcher" })}\n\n`);
      clearInterval(keepAlive);
      res.end();
      return;
    }

    upstream = upstreamResp.body;
    const reader = upstream.getReader();
    const decoder = new TextDecoder();

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } catch (e) {
        // Connection closed
      }
      clearInterval(keepAlive);
      try { res.end(); } catch {}
    };

    pump();

    req.on("close", () => {
      clearInterval(keepAlive);
      try { controller.abort(); } catch {}
      try { reader.cancel(); } catch {}
    });
  } catch (e) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: e.message })}\n\n`);
    clearInterval(keepAlive);
    res.end();
  }
});

// Deploy task — manual promotion to deployed
// Merges PR (if present), triggers ArgoCD sync, waits for sync, updates status

// Batch deploy dry-run — check if PRs can merge
router.post("/deploy/batch/dry-run", async (req, res) => {
  try {
    const { taskIds } = req.body;
    if (!taskIds?.length) return res.status(400).json({ error: "taskIds required" });

    const { data: tasks } = await supabase
      .from("agent_tasks")
      .select("id, title, pull_request_url")
      .in("id", taskIds);

    const results = [];
    for (const t of (tasks || [])) {
      const prUrl = getPrUrl(t);
      if (!prUrl) {
        results.push({ id: t.id, title: t.title, mergeable: false, reason: "no PR" });
        continue;
      }
      const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
      if (!match) {
        results.push({ id: t.id, title: t.title, mergeable: false, reason: "invalid PR URL" });
        continue;
      }
      try {
        const ghUrl = `https://api.github.com/repos/${match[1]}/${match[2]}/pulls/${match[3]}`;
        const ghHeaders = { Authorization: `token ${process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ""}` };
        let ghRes = await fetch(ghUrl, { headers: ghHeaders });
        let pr = await ghRes.json();
        // GitHub returns mergeable:null on first request — retry after 2s
        if (pr.mergeable === null) {
          await new Promise(r => setTimeout(r, 2000));
          ghRes = await fetch(ghUrl, { headers: ghHeaders });
          pr = await ghRes.json();
        }
        const mergeable = pr.mergeable === true;
        let reason = null;
        if (pr.state !== "open") reason = `PR is ${pr.state}`;
        else if (pr.mergeable === false) reason = "has conflicts";
        else if (pr.mergeable === null) reason = "mergeability unknown (try again)";
        results.push({
          id: t.id, title: t.title, mergeable,
          state: pr.state, mergeable_state: pr.mergeable_state,
          pr_number: match[3], reason,
        });
      } catch (e) {
        results.push({ id: t.id, title: t.title, mergeable: false, reason: e.message });
      }
    }

    const allMergeable = results.filter(r => r.mergeable).length;
    const conflicts = results.filter(r => !r.mergeable);

    res.json({
      mergeable: allMergeable,
      total: results.length,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      results,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Batch Deploy ─────────────────────────────────────────────
// Creates a deploy parent task, links selected tasks as subtasks,
// and sets them all to "deploying" status.
router.post("/deploy/batch", async (req, res) => {
  try {
    const { taskIds } = req.body;
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: "taskIds array required" });
    }

    // Fetch the tasks to deploy
    const { data: tasks, error: fetchErr } = await supabase
      .from("agent_tasks")
      .select("id, title, status, pull_request_url, repository_url, deploy_target, type")
      .in("id", taskIds);

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!tasks || tasks.length === 0) return res.status(404).json({ error: "No tasks found" });

    // Check for tasks already deploying (duplicate guard)
    const alreadyDeploying = tasks.filter(t => t.status === "deploying" || t.status === "deployed");
    if (alreadyDeploying.length > 0) {
      return res.status(409).json({
        error: "Some tasks are already deploying or deployed",
        deploying: alreadyDeploying.map(t => ({ id: t.id, title: t.title })),
      });
    }

    // Only deploy completed tasks that have PRs
    const deployable = tasks.filter(t => t.status === "completed" && getPrUrl(t));
    const skipped = tasks.filter(t => t.status !== "completed" || !getPrUrl(t));

    if (deployable.length === 0) {
      return res.status(400).json({ 
        error: "No deployable tasks. Tasks must be completed with a PR URL.",
        skipped: skipped.map(t => ({ id: t.id, title: t.title, reason: !getPrUrl(t) ? "no PR" : `status: ${t.status}` }))
      });
    }

    // Group by repo
    const byRepo = {};
    for (const t of deployable) {
      // Extract repo from PR URL: https://github.com/owner/repo/pull/123
      const prUrl = getPrUrl(t);
      const match = prUrl?.match(/github\.com\/([^/]+\/[^/]+)\/pull/);
      const repo = match ? match[1] : t.repository_url || "unknown";
      if (!byRepo[repo]) byRepo[repo] = [];
      byRepo[repo].push({
        id: t.id,
        title: t.title,
        pr_url: getPrUrl(t),
        pr_number: prUrl?.match(/\/pull\/(\d+)/)?.[1],
        deploy_target: t.deploy_target || "kubernetes",
      });
    }

    // Create the parent deploy task
    const { data: deployTask, error: createErr } = await supabase
      .from("agent_tasks")
      .insert({
        title: `Batch Deploy — ${deployable.length} tasks across ${Object.keys(byRepo).length} repo(s) [${new Date().toISOString().slice(0,16)}]`,
        type: "deploy",
        priority: "urgent",
        status: "todo",
        deploy_target: deployable[0].deploy_target || "kubernetes",
        description: `Merge and deploy ${deployable.length} PRs:\n\n${deployable.map(t => `- ${t.title} (${getPrUrl(t)})`).join("\n")}`,
        metadata: {
          batch_tasks: deployable.map(t => ({ id: t.id, title: t.title, pr_url: getPrUrl(t) })),
          repos: byRepo,
          strategy: "sequential_rebase",
        },
      })
      .select()
      .single();

    if (createErr) return res.status(500).json({ error: createErr.message });

    // Create deployed_by relationships (each task is deployed_by the parent)
    const relationships = deployable.map(t => ({
      source_task_id: t.id,
      target_task_id: deployTask.id,
      relationship_type: "deployed_by",
      created_by: "system",
    }));

    const { error: relErr } = await supabase.from("task_relationships").insert(relationships);
    if (relErr) console.error("[BATCH_DEPLOY] Relationship insert error:", relErr.message);

    // Set all deployable tasks to "deploying"
    const { error: updateErr } = await supabase
      .from("agent_tasks")
      .update({ status: "deploying", updated_at: new Date().toISOString() })
      .in("id", deployable.map(t => t.id));

    if (updateErr) console.error("[BATCH_DEPLOY] Status update error:", updateErr.message);

    res.json({
      ok: true,
      deployTask: { id: deployTask.id, title: deployTask.title },
      deploying: deployable.map(t => ({ id: t.id, title: t.title })),
      skipped: skipped.map(t => ({ id: t.id, title: t.title, reason: !getPrUrl(t) ? "no PR" : `status: ${t.status}` })),
    });
  } catch (e) {
    console.error("[BATCH_DEPLOY] Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Single task deploy — creates a deploy task for the agent (no direct merging)
router.post("/deploy/:id", async (req, res) => {
  try {
    const { data: task, error: fetchErr } = await supabase
      .from("agent_tasks")
      .select("id, title, status, pull_request_url, repository_url, deploy_target, type")
      .eq("id", req.params.id)
      .single();

    if (fetchErr || !task) {
      return res.status(404).json({ ok: false, error: "Task not found" });
    }
    if (task.status === "deployed") {
      return res.json({ ok: true, message: "Task already deployed" });
    }
    if (task.status === "deploying") {
      return res.status(409).json({ ok: false, error: "Task is already deploying" });
    }
    if (task.status !== "completed") {
      return res.status(400).json({ ok: false, error: `Task status is '${task.status}', must be 'completed' to deploy` });
    }

    const prUrl = getPrUrl(task);
    const deployTarget = task.deploy_target || "kubernetes";

    // For deploy_target "none" — just mark deployed directly
    if (deployTarget === "none") {
      await supabase.from("agent_tasks")
        .update({ status: "deployed", updated_at: new Date().toISOString() })
        .eq("id", req.params.id);
      return res.json({ ok: true, message: "No deployment needed — marked deployed" });
    }

    // Create a deploy task for the agent
    const { data: deployTask, error: createErr } = await supabase
      .from("agent_tasks")
      .insert({
        title: `Deploy: ${task.title}`,
        type: "deploy",
        priority: "urgent",
        status: "todo",
        deploy_target: deployTarget,
        description: `Deploy task ${task.id}:\n- ${task.title}\n- PR: ${prUrl || "none"}\n- Target: ${deployTarget}`,
        metadata: {
          batch_tasks: [{ id: task.id, title: task.title, pr_url: prUrl }],
          repos: prUrl ? { [prUrl.match(/github\.com\/([^/]+\/[^/]+)/)?.[1] || "unknown"]: [{ id: task.id, title: task.title, pr_url: prUrl, pr_number: prUrl.match(/\/pull\/(\d+)/)?.[1] }] } : {},
          strategy: "sequential_rebase",
        },
      })
      .select()
      .single();

    if (createErr) return res.status(500).json({ ok: false, error: createErr.message });

    // Link via deployed_by relationship
    await supabase.from("task_relationships").insert({
      source_task_id: task.id,
      target_task_id: deployTask.id,
      relationship_type: "deployed_by",
      created_by: "system",
    });

    // Set task to deploying
    await supabase.from("agent_tasks")
      .update({ status: "deploying", updated_at: new Date().toISOString() })
      .eq("id", req.params.id);

    res.json({
      ok: true,
      deployTask: { id: deployTask.id, title: deployTask.title },
      message: "Deploy task created — agent will handle merging and deployment",
    });
  } catch (e) {
    console.error(`[DEPLOY] Error creating deploy task for ${req.params.id}:`, e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Task comments — chronological thread per task
router.get("/tasks/:id/comments", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", req.params.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/tasks/:id/comments", async (req, res) => {
  try {
    const { body, author, author_type, mentions } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: "body is required" });
    const insertPayload = {
      task_id: req.params.id,
      author: author || "dante",
      author_type: author_type || "user",
      body: body.trim(),
    };
    // Only include mentions if the array is non-empty (column may not exist yet)
    if (mentions && mentions.length > 0) {
      insertPayload.mentions = mentions;
    }
    const { data, error } = await supabase
      .from("task_comments")
      .insert(insertPayload)
      .select()
      .single();
    if (error) throw error;

    // If agents were mentioned, send webhooks with full task context
    if (mentions && mentions.length > 0) {
      notifyMentionedAgents(req.params.id, data, mentions).catch(e => {
        console.error(`[MENTION] Failed to notify agents for task ${req.params.id}:`, e.message);
      });
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Agent reply callback — agents post replies back to task comments
router.post("/tasks/:id/comments/reply", async (req, res) => {
  try {
    const { body, author, comment_id } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: "body is required" });
    if (!author) return res.status(400).json({ error: "author (agent id) is required" });

    const replyPayload = {
      task_id: req.params.id,
      author,
      author_type: "agent",
      body: body.trim(),
    };
    // Only include reply_to if provided (column may not exist yet)
    if (comment_id) {
      replyPayload.reply_to = comment_id;
    }
    const { data, error } = await supabase
      .from("task_comments")
      .insert(replyPayload)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Agent gateway tokens — same pattern as task-dispatcher
const AGENT_TOKENS = {
  neo: process.env.NEO_HOOKS_TOKEN,
  "neo-worker": process.env.NEO_WORKER_HOOKS_TOKEN,
  mu: process.env.MU_HOOKS_TOKEN,
  beta: process.env.BETA_HOOKS_TOKEN,
  "beta-worker": process.env.BETA_WORKER_HOOKS_TOKEN || "beta-worker-hooks-tok-2026",
  flow: process.env.FLOW_HOOKS_TOKEN,
  ifra: process.env.IFRA_HOOKS_TOKEN,
  "ifra-worker": process.env.IFRA_WORKER_HOOKS_TOKEN,
  "research-worker": process.env.RESEARCH_WORKER_HOOKS_TOKEN || "research-worker-hooks-tok-2026",
  "neo-chat-worker": process.env.NEO_CHAT_WORKER_HOOKS_TOKEN,
};

// Send webhook to mentioned agents with full task context
// Uses the standard OpenClaw /hooks/agent format: { message, name, sessionKey, wakeMode }
async function notifyMentionedAgents(taskId, comment, mentions) {
  // Fetch full task
  const { data: task } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  if (!task) return;

  // Fetch all comments for context
  const { data: allComments } = await supabase
    .from("task_comments")
    .select("author, author_type, body, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .limit(50);

  // Fetch agent cards for endpoint URLs
  const { data: agents } = await supabase
    .from("agent_cards")
    .select("id, name, endpoint_url, status")
    .in("id", mentions);

  const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://tasks.dante.id";
  const callbackUrl = `${DASHBOARD_URL}/api/tasks/${taskId}/comments/reply`;

  // Build comment thread text
  const commentThread = (allComments || []).map(c => {
    const time = new Date(c.created_at).toISOString().replace("T", " ").slice(0, 16);
    return `**${c.author}** (${c.author_type}) — ${time}:\n> ${c.body.replace(/\n/g, "\n> ")}`;
  }).join("\n\n");

  // Build the readable message for the agent (standard OpenClaw webhook format)
  const prUrls = Array.isArray(task.pull_request_url) ? task.pull_request_url.join(", ") : (task.pull_request_url || "none");
  const message = `## 💬 Task Comment — @mention from ${comment.author}

**Task:** ${task.title}
**Status:** ${task.status} | **Type:** ${task.type} | **Priority:** ${task.priority}
**Task ID:** ${taskId}
**PR:** ${prUrls}
**Task URL:** ${DASHBOARD_URL}/task/${taskId}

---

### Comment from ${comment.author}:
${comment.body}

---

### Full Comment Thread:
${commentThread}

---

### Task Description:
${task.description || "(no description)"}

${task.result ? `### Previous Result:\n${typeof task.result === "object" ? JSON.stringify(task.result, null, 2) : task.result}\n` : ""}
${task.qa_result ? `### QA Result:\n${typeof task.qa_result === "object" ? JSON.stringify(task.qa_result, null, 2) : task.qa_result}\n` : ""}
---

**Reply callback:** To reply, POST to: \`${callbackUrl}\`
\`\`\`json
{ "body": "your reply text", "author": "${mentions[0]}", "comment_id": "${comment.id}" }
\`\`\``;

  for (const agent of (agents || [])) {
    if (!agent.endpoint_url || agent.status === "disabled") continue;

    const webhookUrl = `${agent.endpoint_url}/hooks/agent`;
    const token = AGENT_TOKENS[agent.id];

    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message,
          name: "Task Comment",
          sessionKey: `hook:comment:${taskId}:${comment.id}`,
          wakeMode: "now",
        }),
      });
      console.log(`[MENTION] Notified ${agent.id} for task ${taskId}: HTTP ${resp.status}`);
    } catch (e) {
      console.error(`[MENTION] Failed to notify ${agent.id}: ${e.message}`);
    }
  }
}

// Activity log for a task (Jira-style field change history)
router.get("/tasks/:id/activity", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const offset = parseInt(req.query.offset) || 0;

    // Fetch both activity log and comments, merge chronologically
    const [activityRes, commentsRes] = await Promise.all([
      supabase
        .from("task_activity_log")
        .select("*", { count: "exact" })
        .eq("task_id", req.params.id)
        .order("changed_at", { ascending: false }),
      supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", req.params.id)
        .order("created_at", { ascending: false }),
    ]);

    if (activityRes.error) throw activityRes.error;

    // Convert comments to activity-like entries
    const commentEntries = (commentsRes.data || []).map(c => ({
      id: 'comment-' + c.id,
      task_id: c.task_id,
      field: 'comment',
      old_value: null,
      new_value: c.body,
      changed_by: c.author,
      changed_at: c.created_at,
      author_type: c.author_type,
    }));

    // Merge and sort by timestamp descending
    const allEntries = [...(activityRes.data || []), ...commentEntries]
      .sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));

    const total = allEntries.length;
    const entries = allEntries.slice(offset, offset + limit);

    // Enrich assigned_agent->null entries with error reason
    const unassignEntries = entries.filter(
      e => e.field === 'assigned_agent' && (!e.new_value || e.new_value === 'null')
    );
    if (unassignEntries.length > 0) {
      const errorEntries = entries.filter(e => e.field === 'error');
      for (const entry of unassignEntries) {
        const entryTime = new Date(entry.changed_at).getTime();
        const hasMatchingError = errorEntries.some(e => Math.abs(new Date(e.changed_at).getTime() - entryTime) < 2000);
        if (!hasMatchingError) {
          const { data: task } = await supabase.from("agent_tasks").select("error").eq("id", req.params.id).single();
          if (task?.error) entry.reason = task.error;
        }
      }
    }

    res.json({ entries, total, limit, offset });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Rebase PR — send task back to agent to resolve merge conflicts
router.post("/tasks/:id/rebase", async (req, res) => {
  const GH_TOKEN = process.env.GH_TOKEN;
  const DISPATCHER_URL = process.env.DISPATCHER_URL || "http://task-dispatcher.agents.svc.cluster.local:8080";

  try {
    // 1. Fetch task
    const { data: task, error: fetchErr } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (fetchErr || !task) {
      return res.status(404).json({ ok: false, error: "Task not found" });
    }

    // 2. Find PR references
    const prRefs = [];
    if (task.pull_request_url && Array.isArray(task.pull_request_url)) {
      for (const url of task.pull_request_url) {
        const m = url.match(/github\.com\/(.+?)\/pull\/(\d+)/);
        if (m) prRefs.push({ repo: m[1], number: parseInt(m[2]), url });
      }
    }

    if (prRefs.length === 0) {
      return res.status(400).json({ ok: false, error: "No PR found on this task — nothing to rebase" });
    }

    if (!GH_TOKEN) {
      return res.status(500).json({ ok: false, error: "GH_TOKEN not configured" });
    }

    // 3. Check mergeability of the first PR
    const pr = prRefs[0];
    const prResp = await fetch(`https://api.github.com/repos/${pr.repo}/pulls/${pr.number}`, {
      headers: { Authorization: `token ${GH_TOKEN}`, Accept: "application/vnd.github.v3+json" },
    });

    if (!prResp.ok) {
      return res.status(400).json({ ok: false, error: `Failed to fetch PR #${pr.number}: HTTP ${prResp.status}` });
    }

    const prData = await prResp.json();

    if (prData.merged) {
      return res.status(400).json({ ok: false, error: `PR #${pr.number} is already merged` });
    }
    if (prData.state === "closed") {
      return res.status(400).json({ ok: false, error: `PR #${pr.number} is closed` });
    }

    // 4. Determine which agent to dispatch to
    const rebaseAgent = task.assigned_agent || task.last_failed_agent || null;

    // 5. Build rebase instructions for the agent
    const rebaseBranch = prData.head?.ref;
    const rebaseBase = prData.base?.ref || "main";
    const rebaseInstructions = `REBASE REQUESTED: Rebase PR #${pr.number} on ${pr.repo}. ` +
      `Branch "${rebaseBranch}" needs to be rebased against "${rebaseBase}" and force-pushed. ` +
      `Steps: git fetch origin, git checkout ${rebaseBranch}, git rebase origin/${rebaseBase}, resolve any conflicts, git push --force-with-lease origin ${rebaseBranch}.`;

    // 5b. Update task: set back to in_progress with rebase instructions in human_input
    const { data: updated, error: updateErr } = await supabase
      .from("agent_tasks")
      .update({
        status: "in_progress",
        assigned_agent: rebaseAgent,
        started_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        result: null,
        human_input: rebaseInstructions,
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ ok: false, error: `Failed to update task: ${updateErr.message}` });
    }

    // 5c. Dispatch to task-dispatcher so an agent picks it up
    try {
      await fetch(`${DISPATCHER_URL}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: req.params.id }),
      });
    } catch (dispatchErr) {
      console.warn(`[REBASE] Dispatch failed for task ${req.params.id}: ${dispatchErr.message} (task updated anyway)`);
    }

    // 6. Log activity
    await supabase.from("task_activity_log").insert({
      task_id: req.params.id,
      field: "rebase_requested",
      old_value: null,
      new_value: `Rebase PR #${pr.number} on ${pr.repo} (branch: ${prData.head?.ref})`,
      changed_by: "dashboard",
      changed_at: new Date().toISOString(),
    }).catch(() => {});

    console.log(`[REBASE] Task ${req.params.id} — rebase requested for PR #${pr.number} on ${pr.repo}, assigned to ${rebaseAgent || "scheduler"}`);

    res.json({
      ok: true,
      task: updated,
      details: {
        pr_number: pr.number,
        repo: pr.repo,
        branch: prData.head?.ref,
        base: prData.base?.ref || "main",
        assigned_to: rebaseAgent || "will be auto-assigned",
        mergeable: prData.mergeable,
        mergeable_state: prData.mergeable_state,
      },
    });
  } catch (e) {
    console.error(`[REBASE] Error for task ${req.params.id}:`, e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Check PR mergeability for a task
router.get("/tasks/:id/mergeability", async (req, res) => {
  const GH_TOKEN = process.env.GH_TOKEN;

  try {
    const { data: task, error } = await supabase
      .from("agent_tasks")
      .select("pull_request_url")
      .eq("id", req.params.id)
      .single();

    if (error || !task) return res.status(404).json({ error: "Task not found" });

    if (!task.pull_request_url?.length) {
      return res.json({ has_pr: false });
    }

    if (!GH_TOKEN) {
      return res.json({ has_pr: true, error: "GH_TOKEN not configured" });
    }

    const results = [];
    for (const url of task.pull_request_url) {
      const m = url.match(/github\.com\/(.+?)\/pull\/(\d+)/);
      if (!m) continue;

      try {
        const prResp = await fetch(`https://api.github.com/repos/${m[1]}/pulls/${parseInt(m[2])}`, {
          headers: { Authorization: `token ${GH_TOKEN}`, Accept: "application/vnd.github.v3+json" },
        });
        if (prResp.ok) {
          const pr = await prResp.json();
          results.push({
            repo: m[1],
            number: parseInt(m[2]),
            mergeable: pr.mergeable,
            mergeable_state: pr.mergeable_state,
            state: pr.state,
            merged: pr.merged,
            branch: pr.head?.ref,
            base: pr.base?.ref,
          });
        }
      } catch {}
    }

    res.json({ has_pr: true, prs: results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Human intervention — provide values for blocked tasks and unblock
router.post("/tasks/:id/intervene", async (req, res) => {
  try {
    const { provided_values, human_response, changed_by } = req.body;

    // 1. Fetch current task
    const { data: task, error: fetchErr } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (fetchErr || !task) return res.status(404).json({ error: "Task not found" });
    if (task.status !== "blocked") {
      return res.status(400).json({ error: `Task status is '${task.status}', must be 'blocked' to intervene` });
    }

    // 2. Build updated metadata
    const metadata = { ...(task.metadata || {}) };
    if (provided_values && Object.keys(provided_values).length > 0) {
      if (!metadata.blocker) metadata.blocker = {};
      metadata.blocker.provided_values = provided_values;
      metadata.blocker.resolved_at = new Date().toISOString();
    }
    if (human_response) {
      if (!metadata.blocker) metadata.blocker = {};
      metadata.blocker.human_response = human_response;
      metadata.blocker.resolved_at = new Date().toISOString();
    }
    // Also store top-level human_input for agent convenience
    const humanInput = human_response || (provided_values ? JSON.stringify(provided_values) : null);

    // 3. Move task back to todo
    const { data: updated, error: updateErr } = await supabase
      .from("agent_tasks")
      .update({
        status: "todo",
        blocked_reason: null,
        error: null,
        assigned_agent: null,
        started_at: null,
        completed_at: null,
        metadata,
        human_input: humanInput,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    // 4. Log the intervention
    const logDetails = [];
    if (provided_values) logDetails.push(`values: ${Object.keys(provided_values).join(", ")}`);
    if (human_response) logDetails.push(`response: "${human_response.slice(0, 100)}${human_response.length > 100 ? '…' : ''}"`);

    await supabase.from("task_activity_log").insert({
      task_id: req.params.id,
      field: "human_intervention",
      old_value: "blocked",
      new_value: `Unblocked with human input (${logDetails.join("; ")})`,
      changed_by: changed_by || "dashboard",
      changed_at: new Date().toISOString(),
    }).catch(() => {});

    res.json({ ok: true, task: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reopen task — human-only action to move completed/deployed tasks back to todo
router.post("/tasks/:id/reopen", async (req, res) => {
  try {
    const reason = req.body.reason || "Reopened from dashboard";
    const { data, error } = await supabase.rpc("reopen_task", {
      p_task_id: req.params.id,
      p_reason: reason,
    });
    if (error) throw error;
    if (data && !data.ok) {
      return res.status(400).json(data);
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
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

// ===== Task Relationships =====

// Get relationships for a task (both directions)
router.get("/tasks/:id/relationships", async (req, res) => {
  try {
    // Get where this task is the source (this task depends_on/blocks/etc other tasks)
    const { data: outgoing, error: e1 } = await supabase
      .from("task_relationships")
      .select("id, target_task_id, relationship_type, created_at, created_by")
      .eq("source_task_id", req.params.id);

    // Get where this task is the target (other tasks depend_on/block/etc this task)
    const { data: incoming, error: e2 } = await supabase
      .from("task_relationships")
      .select("id, source_task_id, relationship_type, created_at, created_by")
      .eq("target_task_id", req.params.id);

    if (e1 || e2) return res.status(500).json({ ok: false, error: (e1 || e2).message });

    // Collect all related task IDs to fetch their titles
    const relatedIds = [
      ...(outgoing || []).map(r => r.target_task_id),
      ...(incoming || []).map(r => r.source_task_id),
    ];

    let taskMap = {};
    if (relatedIds.length > 0) {
      const { data: tasks } = await supabase
        .from("agent_tasks")
        .select("id, title, status, priority, type")
        .in("id", relatedIds);
      taskMap = Object.fromEntries((tasks || []).map(t => [t.id, t]));
    }

    // Format: "this task depends_on X" = outgoing depends_on
    // "X depends_on this task" = incoming depends_on (meaning X is blocked by this)
    const relationships = [
      ...(outgoing || []).map(r => ({
        id: r.id,
        type: r.relationship_type,
        direction: "outgoing", // this task → target
        task: taskMap[r.target_task_id] || { id: r.target_task_id },
        created_at: r.created_at,
      })),
      ...(incoming || []).map(r => ({
        id: r.id,
        type: r.relationship_type,
        direction: "incoming", // source → this task
        task: taskMap[r.source_task_id] || { id: r.source_task_id },
        created_at: r.created_at,
      })),
    ];

    res.json({ ok: true, relationships });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Add a relationship
router.post("/tasks/:id/relationships", async (req, res) => {
  try {
    const { target_task_id, relationship_type = "depends_on" } = req.body;
    if (!target_task_id) return res.status(400).json({ ok: false, error: "target_task_id required" });
    if (target_task_id === req.params.id) return res.status(400).json({ ok: false, error: "Cannot relate task to itself" });

    const validTypes = ["depends_on", "blocks", "related_to", "subtask_of"];
    if (!validTypes.includes(relationship_type)) {
      return res.status(400).json({ ok: false, error: `Invalid type. Valid: ${validTypes.join(", ")}` });
    }

    const { data, error } = await supabase
      .from("task_relationships")
      .insert({
        source_task_id: req.params.id,
        target_task_id,
        relationship_type,
        created_by: "dashboard",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return res.status(409).json({ ok: false, error: "Relationship already exists" });
      return res.status(500).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, relationship: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Delete a relationship
router.delete("/relationships/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("task_relationships")
      .delete()
      .eq("id", req.params.id);

    if (error) return res.status(500).json({ ok: false, error: error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Helper: normalize pull_request_url (can be string or array)
function getPrUrl(task) {
  const pr = task.pull_request_url;
  if (!pr) return null;
  if (Array.isArray(pr)) return pr[0] || null;
  return pr;
}


