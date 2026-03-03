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
    const stats = { todo: 0, assigned: 0, in_progress: 0, done: 0, qa: 0, qa_testing: 0, completed: 0, failed: 0, deployed: 0, blocked: 0 };
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
router.post("/deploy/:id", async (req, res) => {
  const GH_TOKEN = process.env.GH_TOKEN;
  const ARGOCD_URL = process.env.ARGOCD_URL || "http://argocd-server.argocd.svc.cluster.local";
  const ARGOCD_USERNAME = process.env.ARGOCD_USERNAME;
  const ARGOCD_PASSWORD = process.env.ARGOCD_PASSWORD;
  const ARGOCD_TOKEN_ENV = process.env.ARGOCD_TOKEN;
  const ARGOCD_APP = process.env.ARGOCD_APP || "dev";
  const SYNC_TIMEOUT = 120_000; // 2 minutes
  const SYNC_POLL_INTERVAL = 5_000; // 5 seconds

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
    if (task.status !== "completed") {
      return res.status(400).json({ ok: false, error: `Task status is '${task.status}', must be 'completed' to deploy` });
    }

    // 2. Extract PR reference — prefer pull_request_url column, fall back to parsing result
    let prNumber = null;
    let repoFullName = null;
    if (task.pull_request_url) {
      // pull_request_url format: https://github.com/OWNER/REPO/pull/NUMBER
      const prRefMatch = task.pull_request_url.match(/github\.com\/(.+?)\/pull\/(\d+)/);
      if (prRefMatch) {
        repoFullName = prRefMatch[1];
        prNumber = parseInt(prRefMatch[2]);
      }
    }
    if (!prNumber && task.result) {
      const resultStr = typeof task.result === "string" ? task.result : JSON.stringify(task.result);
      const prMatch = resultStr.match(/PR\s*#(\d+)/i) || resultStr.match(/#(\d+)\s*merged/i);
      if (prMatch) prNumber = parseInt(prMatch[1]);
      if (!repoFullName) {
        const repoMatch = resultStr.match(/(dante-alpha-assistant\/[\w-]+)/);
        if (repoMatch) repoFullName = repoMatch[1];
      }
    }

    // 3. If PR exists, merge it via GitHub API (squash merge, delete branch)
    if (prNumber && GH_TOKEN) {
      if (!repoFullName) {
        // Try to find repo from repository relation
        if (task.repository_id) {
          const { data: repo } = await supabase.from("agent_repositories").select("url").eq("id", task.repository_id).single();
          if (repo?.url) {
            const m = repo.url.match(/github\.com\/(.+?)(?:\.git)?$/);
            if (m) repoFullName = m[1];
          }
        }
        // Try project's default repo
        if (!repoFullName && task.project_id) {
          const { data: repos } = await supabase.from("agent_repositories").select("url").eq("project_id", task.project_id).limit(1);
          if (repos?.[0]?.url) {
            const m = repos[0].url.match(/github\.com\/(.+?)(?:\.git)?$/);
            if (m) repoFullName = m[1];
          }
        }
        // Try searching GitHub for the PR number across org repos
        if (!repoFullName && GH_TOKEN) {
          try {
            const searchResp = await fetch(`https://api.github.com/search/issues?q=is:pr+org:dante-alpha-assistant+${prNumber}+in:title`, {
              headers: { Authorization: `token ${GH_TOKEN}`, Accept: "application/vnd.github.v3+json" },
            });
            if (searchResp.ok) {
              const searchData = await searchResp.json();
              const match = searchData.items?.find(i => i.number === prNumber);
              if (match?.repository_url) {
                repoFullName = match.repository_url.replace("https://api.github.com/repos/", "");
              }
            }
          } catch {}
        }
        if (!repoFullName) {
          return res.status(400).json({ ok: false, error: `Cannot determine repository for PR #${prNumber}. No repo reference in task result, no repository_id, and no project repos found.` });
        }
      }

      // Check PR status first
      const prResp = await fetch(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}`, {
        headers: { Authorization: `token ${GH_TOKEN}`, Accept: "application/vnd.github.v3+json" },
      });
      if (!prResp.ok) {
        return res.status(400).json({ ok: false, error: `Failed to fetch PR #${prNumber} on ${repoFullName}: ${prResp.status}` });
      }
      const pr = await prResp.json();

      if (pr.merged) {
        // Already merged — skip merge step
        console.log(`[DEPLOY] PR #${prNumber} on ${repoFullName} already merged, skipping merge`);
      } else if (pr.state === "closed") {
        return res.status(400).json({ ok: false, error: `PR #${prNumber} is closed but not merged` });
      } else {
        // Merge the PR (squash)
        const mergeResp = await fetch(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/merge`, {
          method: "PUT",
          headers: { Authorization: `token ${GH_TOKEN}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
          body: JSON.stringify({ merge_method: "squash", commit_title: `${task.title} (#${prNumber})` }),
        });

        if (!mergeResp.ok) {
          const mergeErr = await mergeResp.json().catch(() => ({}));
          const reason = mergeErr.message || `HTTP ${mergeResp.status}`;
          return res.status(400).json({ ok: false, error: `Merge conflict or failure on PR #${prNumber}: ${reason}` });
        }

        console.log(`[DEPLOY] Merged PR #${prNumber} on ${repoFullName} (squash)`);

        // Delete the branch
        if (pr.head?.ref) {
          try {
            await fetch(`https://api.github.com/repos/${repoFullName}/git/refs/heads/${pr.head.ref}`, {
              method: "DELETE",
              headers: { Authorization: `token ${GH_TOKEN}` },
            });
          } catch {} // Best effort
        }
      }
    }

    // 4. Trigger ArgoCD sync
    let argoToken = ARGOCD_TOKEN_ENV;
    let syncTriggered = false;

    try {
      if (!argoToken && ARGOCD_USERNAME && ARGOCD_PASSWORD) {
        const sessResp = await fetch(`${ARGOCD_URL}/api/v1/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: ARGOCD_USERNAME, password: ARGOCD_PASSWORD }),
        });
        if (sessResp.ok) {
          const sessData = await sessResp.json();
          argoToken = sessData.token;
        }
      }

      if (argoToken) {
        const syncResp = await fetch(`${ARGOCD_URL}/api/v1/applications/${ARGOCD_APP}/sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${argoToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        syncTriggered = syncResp.ok;
        if (!syncResp.ok) {
          console.warn(`[DEPLOY] ArgoCD sync trigger returned ${syncResp.status} — will still poll`);
        }
      }
    } catch (e) {
      console.warn(`[DEPLOY] ArgoCD sync trigger failed: ${e.message} — will still poll`);
    }

    // 5. Poll ArgoCD for sync success (timeout 2min)
    let syncSucceeded = false;
    if (argoToken) {
      const startTime = Date.now();
      while (Date.now() - startTime < SYNC_TIMEOUT) {
        try {
          const appResp = await fetch(`${ARGOCD_URL}/api/v1/applications/${ARGOCD_APP}`, {
            headers: { Authorization: `Bearer ${argoToken}` },
          });
          if (appResp.ok) {
            const app = await appResp.json();
            const syncStatus = app?.status?.sync?.status;
            const healthStatus = app?.status?.health?.status;
            if (syncStatus === "Synced" && (healthStatus === "Healthy" || healthStatus === "Progressing")) {
              syncSucceeded = true;
              break;
            }
          }
        } catch {}
        await new Promise(r => setTimeout(r, SYNC_POLL_INTERVAL));
      }

      if (!syncSucceeded) {
        return res.status(504).json({ ok: false, error: "ArgoCD sync timed out after 2 minutes. PR was merged but sync did not complete. Check ArgoCD status manually." });
      }
    } else {
      // No ArgoCD credentials — skip sync verification, just mark deployed
      console.log(`[DEPLOY] No ArgoCD credentials configured, skipping sync verification`);
      syncSucceeded = true;
    }

    // 6. Update task status to deployed
    const { data: updated, error: updateErr } = await supabase
      .from("agent_tasks")
      .update({
        status: "deployed",
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
        pr_merged: prNumber ? `#${prNumber}` : null,
        repo: repoFullName,
        argocd_synced: syncSucceeded,
        sync_triggered: syncTriggered,
      },
    });
  } catch (e) {
    console.error(`[DEPLOY] Error deploying task ${req.params.id}:`, e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Activity log for a task (Jira-style field change history)
router.get("/tasks/:id/activity", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("task_activity_log")
      .select("*")
      .eq("task_id", req.params.id)
      .order("changed_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json(data || []);
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
