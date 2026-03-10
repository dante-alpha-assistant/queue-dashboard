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
        const ghRes = await fetch(`https://api.github.com/repos/${match[1]}/${match[2]}/pulls/${match[3]}`, {
          headers: { Authorization: `token ${process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ""}` },
        });
        const pr = await ghRes.json();
        results.push({
          id: t.id, title: t.title,
          mergeable: pr.mergeable === true,
          state: pr.state,
          mergeable_state: pr.mergeable_state,
          reason: pr.mergeable === false ? "has conflicts" : pr.state !== "open" ? `PR is ${pr.state}` : null,
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
    const alreadyDeploying = tasks.filter(t => t.status === "deploying");
    if (alreadyDeploying.length > 0) {
      return res.status(409).json({
        error: "Some tasks are already deploying",
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
        title: `Batch Deploy — ${deployable.length} tasks across ${Object.keys(byRepo).length} repo(s)`,
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

    await supabase.from("task_relationships").insert(relationships);

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

router.post("/deploy/:id", async (req, res) => {
  const GH_TOKEN = process.env.GH_TOKEN;
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
  const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
  const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;
  const ARGOCD_URL = process.env.ARGOCD_URL || "http://argocd-server.argocd.svc.cluster.local";
  const ARGOCD_USERNAME = process.env.ARGOCD_USERNAME;
  const ARGOCD_PASSWORD = process.env.ARGOCD_PASSWORD;
  const ARGOCD_TOKEN_ENV = process.env.ARGOCD_TOKEN;
  const ARGOCD_APP = process.env.ARGOCD_APP || "dev";
  const SYNC_TIMEOUT = 120_000;
  const SYNC_POLL_INTERVAL = 5_000;

  try {
    // 1. Fetch task and verify it's completed
    const { data: task, error: fetchErr } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (fetchErr || !task) {
      return res.status(404).json({ ok: false, error: "Task not found" });
    }
    if (task.status === "deployed") {
      return res.json({ ok: true, message: "Task already deployed" });
    }
    if (task.status !== "completed" && task.status !== "deploying") {
      return res.status(400).json({ ok: false, error: `Task status is '${task.status}', must be 'completed' to deploy` });
    }

    const deployTarget = task.deploy_target || "kubernetes";

    // Set status to 'deploying' immediately so UI shows progress
    await supabase.from('agent_tasks').update({ status: 'deploying' }).eq('id', req.params.id);
    console.log(`[DEPLOY] Task ${req.params.id} → deploying (target: ${deployTarget})`);
    console.log(`[DEPLOY] Task ${req.params.id} — deploy_target: ${deployTarget}`);

    // 2. Collect all PR references
    const prRefs = [];
    if (task.pull_request_url && Array.isArray(task.pull_request_url)) {
      for (const url of task.pull_request_url) {
        const m = url.match(/github\.com\/(.+?)\/pull\/(\d+)/);
        if (m) prRefs.push({ repo: m[1], number: parseInt(m[2]), url });
      }
    }
    if (prRefs.length === 0 && task.result) {
      const resultStr = typeof task.result === "string" ? task.result : JSON.stringify(task.result);
      const prMatch = resultStr.match(/PR\s*#(\d+)/i) || resultStr.match(/#(\d+)\s*merged/i);
      if (prMatch) {
        const prNumber = parseInt(prMatch[1]);
        let repoFullName = null;
        const repoMatch = resultStr.match(/(dante-alpha-assistant\/[\w-]+)/);
        if (repoMatch) repoFullName = repoMatch[1];
        if (repoFullName) prRefs.push({ repo: repoFullName, number: prNumber });
      }
    }

    // 3. Merge PRs (shared across all deploy targets)
    const mergedPRs = [];
    if (prRefs.length > 0 && !GH_TOKEN) {
      await supabase.from('agent_tasks').update({ status: 'deploy_failed', error: 'GH_TOKEN not configured', updated_at: new Date().toISOString() }).eq('id', req.params.id);
      return res.status(500).json({ ok: false, error: "GH_TOKEN not configured — cannot merge PRs." });
    }
    for (const pr of prRefs) {
      if (!GH_TOKEN) continue;
      const prResp = await fetch(`https://api.github.com/repos/${pr.repo}/pulls/${pr.number}`, {
        headers: { Authorization: `token ${GH_TOKEN}`, Accept: "application/vnd.github.v3+json" },
      });
      if (!prResp.ok) {
        await supabase.from('agent_tasks').update({ status: 'deploy_failed', error: `Failed to fetch PR #${pr.number}`, updated_at: new Date().toISOString() }).eq('id', req.params.id);
        return res.status(400).json({ ok: false, error: `Failed to fetch PR #${pr.number} on ${pr.repo}: ${prResp.status}` });
      }
      const prData = await prResp.json();
      if (prData.merged) {
        mergedPRs.push(`#${pr.number} (${pr.repo}) — already merged`);
      } else if (prData.state === "closed") {
        await supabase.from('agent_tasks').update({ status: 'deploy_failed', error: `PR #${pr.number} closed but not merged`, updated_at: new Date().toISOString() }).eq('id', req.params.id);
        return res.status(400).json({ ok: false, error: `PR #${pr.number} on ${pr.repo} is closed but not merged` });
      } else {
        const mergeResp = await fetch(`https://api.github.com/repos/${pr.repo}/pulls/${pr.number}/merge`, {
          method: "PUT",
          headers: { Authorization: `token ${GH_TOKEN}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
          body: JSON.stringify({ merge_method: "squash", commit_title: `${task.title} (#${pr.number})` }),
        });
        if (!mergeResp.ok) {
          const mergeErr = await mergeResp.json().catch(() => ({}));
          await supabase.from('agent_tasks').update({ status: 'deploy_failed', error: `Merge failed: ${mergeErr.message || mergeResp.status}`, updated_at: new Date().toISOString() }).eq('id', req.params.id);
          return res.status(400).json({ ok: false, error: `Merge failed on PR #${pr.number} (${pr.repo}): ${mergeErr.message || mergeResp.status}` });
        }
        mergedPRs.push(`#${pr.number} (${pr.repo}) — merged`);
        if (prData.head?.ref) {
          try { await fetch(`https://api.github.com/repos/${pr.repo}/git/refs/heads/${prData.head.ref}`, { method: "DELETE", headers: { Authorization: `token ${GH_TOKEN}` } }); } catch {}
        }
      }
    }

    // 4. Deploy based on target
    let deployResult = {};

    if (deployTarget === "none") {
      // No deployment needed — just mark as deployed
      console.log(`[DEPLOY] Target is 'none' — skipping deployment, marking deployed`);
      deployResult = { strategy: "none", message: "No deployment needed" };

    } else if (deployTarget === "vercel") {
      // Vercel deployment
      console.log(`[DEPLOY] Target is 'vercel' — triggering Vercel deployment`);

      if (!VERCEL_TOKEN) {
        await supabase.from('agent_tasks').update({ status: 'deploy_failed', error: 'VERCEL_TOKEN not configured', updated_at: new Date().toISOString() }).eq('id', req.params.id);
        return res.status(500).json({ ok: false, error: "VERCEL_TOKEN not configured — cannot deploy to Vercel." });
      }

      // Determine the repo to deploy
      const repoUrl = task.repository_url || (prRefs[0] ? `https://github.com/${prRefs[0].repo}` : null);
      const repoFullName = repoUrl?.match(/github\.com\/(.+?)(?:\.git)?$/)?.[1];

      if (!repoFullName) {
        await supabase.from('agent_tasks').update({ status: 'deploy_failed', error: 'No repository URL found', updated_at: new Date().toISOString() }).eq('id', req.params.id);
        return res.status(400).json({ ok: false, error: "No repository URL found — cannot deploy to Vercel." });
      }

      const vercelHeaders = {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      };
      const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : "";

      // Check if project already exists in Vercel
      const projectName = repoFullName.split("/")[1]; // e.g. "hello-world-site"
      let vercelProject = null;

      try {
        const projResp = await fetch(`https://api.vercel.com/v9/projects/${projectName}${teamParam}`, {
          headers: vercelHeaders,
        });
        if (projResp.ok) {
          vercelProject = await projResp.json();
          console.log(`[DEPLOY] Found existing Vercel project: ${projectName}`);
        }
      } catch {}

      // If no project, import the repo
      if (!vercelProject) {
        console.log(`[DEPLOY] Creating new Vercel project for ${repoFullName}`);
        const importResp = await fetch(`https://api.vercel.com/v10/projects${teamParam}`, {
          method: "POST",
          headers: vercelHeaders,
          body: JSON.stringify({
            name: projectName,
            framework: null, // auto-detect
            gitRepository: {
              type: "github",
              repo: repoFullName,
            },
          }),
        });

        if (!importResp.ok) {
          const err = await importResp.json().catch(() => ({}));
          const rawMsg = err.error?.message || `HTTP ${importResp.status}`;
          let errMsg = `Vercel project creation failed: ${rawMsg}`;
          let actionRequired = null;

          // Detect missing GitHub integration and provide actionable guidance
          if (rawMsg.toLowerCase().includes('github integration') || rawMsg.toLowerCase().includes('install the github')) {
            errMsg = `Vercel GitHub integration not installed. Cannot link repo '${repoFullName}'.`;
            actionRequired = 'Install the Vercel GitHub integration at https://vercel.com/integrations/github for the GitHub org/account, then retry.';
            errMsg += ` Action required: ${actionRequired}`;
          }

          await supabase.from('agent_tasks').update({ status: 'deploy_failed', error: errMsg, updated_at: new Date().toISOString() }).eq('id', req.params.id);
          return res.status(400).json({ ok: false, error: errMsg, action_required: actionRequired });
        }
        vercelProject = await importResp.json();
        console.log(`[DEPLOY] Created Vercel project: ${vercelProject.name}`);
      }

      // Trigger a new deployment
      const deployResp = await fetch(`https://api.vercel.com/v13/deployments${teamParam}`, {
        method: "POST",
        headers: vercelHeaders,
        body: JSON.stringify({
          name: projectName,
          project: vercelProject.id,
          gitSource: {
            type: "github",
            org: repoFullName.split("/")[0],
            repo: repoFullName.split("/")[1],
            ref: "main",
          },
        }),
      });

      if (!deployResp.ok) {
        const err = await deployResp.json().catch(() => ({}));
        // If deployment fails, still mark as deployed if PRs were merged
        console.warn(`[DEPLOY] Vercel deployment trigger failed: ${err.error?.message || deployResp.status}`);
        deployResult = { strategy: "vercel", error: err.error?.message || `HTTP ${deployResp.status}` };
      } else {
        const deployment = await deployResp.json();
        const deploymentUrl = deployment.url ? `https://${deployment.url}` : null;
        console.log(`[DEPLOY] Vercel deployment triggered: ${deploymentUrl}`);
        deployResult = {
          strategy: "vercel",
          deployment_url: deploymentUrl,
          project_url: `https://vercel.com/${VERCEL_TEAM_ID || "~"}/${projectName}`,
          project_name: projectName,
        };
      }

    } else if (deployTarget === "railway") {
      // Railway deployment via GraphQL API
      console.log(`[DEPLOY] Target is 'railway' — triggering Railway deployment`);

      if (!RAILWAY_TOKEN) {
        await supabase.from('agent_tasks').update({ status: 'deploy_failed', error: 'RAILWAY_TOKEN not configured', updated_at: new Date().toISOString() }).eq('id', req.params.id);
        return res.status(500).json({ ok: false, error: "RAILWAY_TOKEN not configured — cannot deploy to Railway." });
      }

      const repoUrl = task.repository_url || (prRefs[0] ? `https://github.com/${prRefs[0].repo}` : null);
      const repoFullName = repoUrl?.match(/github\.com\/(.+?)(?:\.git)?$/)?.[1];

      if (!repoFullName) {
        await supabase.from('agent_tasks').update({ status: 'deploy_failed', error: 'No repository URL found', updated_at: new Date().toISOString() }).eq('id', req.params.id);
        return res.status(400).json({ ok: false, error: "No repository URL found — cannot deploy to Railway." });
      }

      const railwayGQL = async (query, variables = {}) => {
        const resp = await fetch("https://backboard.railway.com/graphql/v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RAILWAY_TOKEN}`,
          },
          body: JSON.stringify({ query, variables }),
        });
        const json = await resp.json();
        if (json.errors) throw new Error(json.errors[0].message);
        return json.data;
      };

      const projectName = repoFullName.split("/")[1];

      try {
        // 1. Check if project already exists (search by name)
        let projectId = null;
        let environmentId = null;
        let serviceId = null;

        const projectsData = await railwayGQL(`
          query { me { projects { edges { node { id name services { edges { node { id name } } } environments { edges { node { id name } } } } } } } }
        `);

        const existingProject = projectsData.me.projects.edges.find(
          e => e.node.name.toLowerCase() === projectName.toLowerCase()
        );

        if (existingProject) {
          projectId = existingProject.node.id;
          environmentId = existingProject.node.environments.edges.find(e => e.node.name === "production")?.node.id;
          serviceId = existingProject.node.services.edges[0]?.node.id;
          console.log(`[DEPLOY] Found existing Railway project: ${projectName} (${projectId})`);
        }

        // 2. If no project, create one from GitHub repo
        if (!projectId) {
          console.log(`[DEPLOY] Creating new Railway project for ${repoFullName}`);
          const createData = await railwayGQL(`
            mutation($input: ProjectCreateInput!) {
              projectCreate(input: $input) { id environments { edges { node { id name } } } }
            }
          `, {
            input: {
              name: projectName,
              repo: { fullRepoName: repoFullName },
            },
          });
          projectId = createData.projectCreate.id;
          environmentId = createData.projectCreate.environments.edges.find(e => e.node.name === "production")?.node.id;
          console.log(`[DEPLOY] Created Railway project: ${projectId}`);

          // Wait briefly for service to be created from repo
          await new Promise(r => setTimeout(r, 3000));

          // Fetch the service created from the repo
          const svcData = await railwayGQL(`
            query($projectId: String!) {
              project(id: $projectId) { services { edges { node { id name } } } }
            }
          `, { projectId });
          serviceId = svcData.project.services.edges[0]?.node.id;
        }

        // 3. Trigger a redeploy if we have a service
        let deploymentUrl = null;
        if (serviceId && environmentId) {
          // Get latest deployment to redeploy
          const deploymentsData = await railwayGQL(`
            query($input: DeploymentListInput!) {
              deployments(input: $input) { edges { node { id status } } }
            }
          `, { input: { serviceId, environmentId } });

          const latestDeployment = deploymentsData.deployments.edges[0]?.node;

          if (latestDeployment) {
            await railwayGQL(`
              mutation($id: String!) {
                deploymentRedeploy(id: $id) { id }
              }
            `, { id: latestDeployment.id });
            console.log(`[DEPLOY] Redeployed Railway service ${serviceId}`);
          }

          // Get the service domain
          const domainData = await railwayGQL(`
            query($projectId: String!, $serviceId: String!, $environmentId: String!) {
              domains(projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId) { serviceDomains { domain } customDomains { domain } }
            }
          `, { projectId, serviceId, environmentId });

          const domain = domainData.domains?.serviceDomains?.[0]?.domain || domainData.domains?.customDomains?.[0]?.domain;
          if (domain) deploymentUrl = `https://${domain}`;
        }

        deployResult = {
          strategy: "railway",
          project_id: projectId,
          service_id: serviceId,
          deployment_url: deploymentUrl,
          project_url: `https://railway.com/project/${projectId}`,
          project_name: projectName,
        };
      } catch (railwayErr) {
        console.error(`[DEPLOY] Railway error: ${railwayErr.message}`);
        await supabase.from('agent_tasks').update({ status: 'deploy_failed', error: `Railway deploy failed: ${railwayErr.message}`, updated_at: new Date().toISOString() }).eq('id', req.params.id);
        return res.status(500).json({ ok: false, error: `Railway deploy failed: ${railwayErr.message}` });
      }

    } else {
      // Default: kubernetes (ArgoCD)
      let argoToken = ARGOCD_TOKEN_ENV;
      let syncTriggered = false;
      let syncSucceeded = false;

      try {
        if (!argoToken && ARGOCD_USERNAME && ARGOCD_PASSWORD) {
          const sessResp = await fetch(`${ARGOCD_URL}/api/v1/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: ARGOCD_USERNAME, password: ARGOCD_PASSWORD }),
          });
          if (sessResp.ok) {
            argoToken = (await sessResp.json()).token;
          }
        }

        if (argoToken) {
          const syncResp = await fetch(`${ARGOCD_URL}/api/v1/applications/${ARGOCD_APP}/sync`, {
            method: "POST",
            headers: { Authorization: `Bearer ${argoToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ prune: false, strategy: { hook: {} } }),
          });
          syncTriggered = syncResp.ok;
        }
      } catch (e) {
        console.warn(`[DEPLOY] ArgoCD sync trigger failed: ${e.message}`);
      }

      if (argoToken) {
        const startTime = Date.now();
        while (Date.now() - startTime < SYNC_TIMEOUT) {
          try {
            const appResp = await fetch(`${ARGOCD_URL}/api/v1/applications/${ARGOCD_APP}`, {
              headers: { Authorization: `Bearer ${argoToken}` },
            });
            if (appResp.ok) {
              const app = await appResp.json();
              if (app?.status?.sync?.status === "Synced" || app?.status?.health?.status === "Healthy") {
                syncSucceeded = true;
                break;
              }
            }
          } catch {}
          await new Promise(r => setTimeout(r, SYNC_POLL_INTERVAL));
        }
        if (!syncSucceeded) {
          console.warn(`[DEPLOY] ArgoCD sync timed out — PR merged, marking deployed anyway`);
        }
      }

      deployResult = { strategy: "kubernetes", argocd_synced: syncSucceeded, sync_triggered: syncTriggered };
    }

    // 5. Update task status to deployed
    const deploymentUrl = deployResult.deployment_url || null;
    const { data: updated, error: updateErr } = await supabase
      .from("agent_tasks")
      .update({
        status: "deployed",
        deployment_url: deploymentUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ ok: false, error: `Failed to update task status: ${updateErr.message}` });
    }

    res.json({
      ok: true,
      task: updated,
      details: {
        deploy_target: deployTarget,
        prs_merged: mergedPRs,
        ...deployResult,
      },
    });
  } catch (e) {
    console.error(`[DEPLOY] Error deploying task ${req.params.id}:`, e.message);
    // Set status to deploy_failed so user can see what happened
    await supabase.from('agent_tasks').update({ 
      status: 'deploy_failed', 
      error: `Deploy failed: ${e.message}`,
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id).catch(() => {});
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
    const { body, author, author_type } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: "body is required" });
    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: req.params.id,
        author: author || "dante",
        author_type: author_type || "human",
        body: body.trim(),
      })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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


