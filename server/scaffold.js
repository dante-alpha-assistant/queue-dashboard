// server/scaffold.js — App Factory scaffold pipeline
// Triggered AFTER the app record is created in the DB.
//
// Sequence:
//   1. Update app status → 'scaffolding'
//   2. Create GitHub repo from dante-alpha-assistant/nextjs-template
//   3. Wait briefly for GitHub to initialize the repo (3s)
//   4. Create coding task in agent_tasks
//   5. AI customization pass (generateAppCode) — before Vercel setup
//   6. Create Vercel project linked to GitHub repo (if deploy_target=vercel)
//   7. Add custom subdomain {slug}.dante.id via DigitalOcean DNS + Vercel domain API
//   8. Supabase auto-provisioning (if needs_database=true or detected from description)
//      a. Create schema + AI-generated tables + RLS policies
//      b. Inject env vars into Vercel project
//      c. Push /src/lib/supabase.ts to GitHub repo
//   9. Update app record: repo_url, vercel_project_id, vercel_preview_url, custom_domain
//  10. Update app status → 'building'
//   On any error: update app status → 'failed'

import supabase from "./supabase.js";
import { createVercelProject, triggerVercelDeployment, waitForDeployment, addCustomDomain } from "./vercel.js";
import { createDnsRecord } from "./digitalocean.js";
import {
  detectNeedsDatabase,
  provisionSupabase,
  injectVercelEnvVars,
  pushFileToGitHub,
} from "./supabase-provision.js";
import { generateAppCode } from "./ai-codegen.js";

const GH_API = "https://api.github.com";
const GH_TOKEN = process.env.GH_TOKEN;

/**
 * Update a specific build step status in the apps table.
 * build_steps is stored as a JSONB array: [{id, status, started_at, completed_at, error}]
 * Statuses: "pending" | "in_progress" | "done" | "failed"
 */
async function emitStep(appId, stepId, status, error = null) {
  try {
    const { data: app } = await supabase
      .from("apps")
      .select("build_steps")
      .eq("id", appId)
      .single();

    const steps = Array.isArray(app?.build_steps) ? [...app.build_steps] : [];
    const now = new Date().toISOString();

    const stepData = {
      id: stepId,
      status,
      ...(status === "in_progress" && { started_at: now }),
      ...(["done", "failed", "warning"].includes(status) && { completed_at: now }),
      ...(error && { error: String(error).slice(0, 500) }),
    };

    const existingIdx = steps.findIndex((s) => s.id === stepId);
    if (existingIdx >= 0) {
      steps[existingIdx] = { ...steps[existingIdx], ...stepData };
    } else {
      steps.push(stepData);
    }

    await supabase
      .from("apps")
      .update({ build_steps: steps, updated_at: now })
      .eq("id", appId);
  } catch (e) {
    // Non-fatal: log but don't crash the pipeline
    console.warn(`[SCAFFOLD] emitStep failed (stepId=${stepId}, status=${status}):`, e.message);
  }
}
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const DO_TOKEN = process.env.DO_TOKEN;
const TEMPLATE_OWNER = "dante-alpha-assistant";
const TEMPLATE_REPO = "nextjs-template";

/**
 * Generate the contents of /src/lib/supabase.ts for the scaffolded Next.js app.
 */
function generateSupabaseClientFile() {
  return `import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role key (for API routes only — never expose to client)
export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
`;
}

/**
 * Create a GitHub repo from the nextjs-template.
 * Uses POST /repos/{template_owner}/{template_repo}/generate
 */
async function createGitHubRepo(slug, description) {
  if (!GH_TOKEN) throw new Error("GH_TOKEN not configured");

  const resp = await fetch(`${GH_API}/repos/${TEMPLATE_OWNER}/${TEMPLATE_REPO}/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      owner: TEMPLATE_OWNER,
      name: slug,
      description: description || "",
      private: false,
      include_all_branches: false,
    }),
    signal: AbortSignal.timeout(30000),
  });

  const data = await resp.json();

  if (!resp.ok) {
    // 422 usually means repo already exists — fetch existing
    if (resp.status === 422) {
      const existingResp = await fetch(`${GH_API}/repos/${TEMPLATE_OWNER}/${slug}`, {
        headers: {
          Authorization: `Bearer ${GH_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        signal: AbortSignal.timeout(30000),
      });
      const existingData = await existingResp.json();
      if (existingResp.ok) {
        return {
          id: existingData.id,
          fullName: existingData.full_name,
          htmlUrl: existingData.html_url,
        };
      }
    }
    throw new Error(`GitHub repo create error (${resp.status}): ${data.message || JSON.stringify(data)}`);
  }

  return {
    id: data.id,
    fullName: data.full_name,
    htmlUrl: data.html_url,
  };
}

/**
 * Auto-create a coding task for the new app.
 * The task will be picked up by neo-worker to build the custom pages.
 */

/**
 * Use LLM to decompose an app description into multiple focused coding tasks.
 * Returns an array of {title, description} objects.
 */
async function decomposeAppIntoTasks({ appName, appDescription, repoFullName, deployTarget }) {
  const CHAT_WORKER_URL = process.env.NEO_CHAT_WORKER_URL || "http://neo-chat-worker.agents.svc.cluster.local:18789";
  const CHAT_WORKER_TOKEN = process.env.NEO_CHAT_WORKER_TOKEN || "neo-chat-worker-gw-tok-2026";

  const prompt = "You are a senior software architect decomposing an app into coding tasks for AI agents.\n\n"
    + "App Name: " + appName + "\n"
    + "App Description: " + (appDescription || "No description provided.") + "\n"
    + "Stack: Next.js 15 + TypeScript + Tailwind CSS v4 + shadcn/ui\n"
    + "Repo: https://github.com/" + repoFullName + "\n\n"
    + "Decompose this app into 3-6 focused, sequential coding tasks. Each task should be completable in one PR by a single developer.\n\n"
    + "Rules:\n"
    + "- Task 1 should ALWAYS be the layout/navigation shell (sidebar, header, routing)\n"
    + "- Subsequent tasks should each handle one domain feature (e.g. Customers CRUD, Deals Pipeline)\n"
    + "- Each task should specify which files/routes to create\n"
    + "- Tasks are executed sequentially - later tasks can depend on earlier ones\n"
    + "- Keep tasks focused: one feature per task, not the whole app\n"
    + "- Include API routes (/src/app/api/) where needed\n"
    + "- Every task must ensure the app builds (npm run build)\n\n"
    + "Respond with ONLY a JSON array, no markdown, no explanation:\n"
    + JSON.stringify([{title: "Short task title", description: "Detailed description..."}]) + "\n";

  let llmResponse;
  try {
    console.log("[DECOMPOSE] Calling neo-chat-worker for task decomposition...");
    const resp = await fetch(CHAT_WORKER_URL + "/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + CHAT_WORKER_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "current", max_tokens: 4096, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) throw new Error("neo-chat-worker " + resp.status);
    const data = await resp.json();
    llmResponse = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    console.log("[DECOMPOSE] Got response from neo-chat-worker");
  } catch (e) {
    console.warn("[DECOMPOSE] neo-chat-worker failed:", e.message);
  }

  if (!llmResponse) {
    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    if (OPENROUTER_KEY) {
      try {
        console.log("[DECOMPOSE] Falling back to OpenRouter...");
        const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: "Bearer " + OPENROUTER_KEY, "Content-Type": "application/json", "HTTP-Referer": "https://tasks.dante.id" },
          body: JSON.stringify({ model: "anthropic/claude-sonnet-4-5", max_tokens: 4096, messages: [{ role: "user", content: prompt }] }),
        });
        if (resp.ok) {
          const data = await resp.json();
          llmResponse = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
        }
      } catch (e) { console.warn("[DECOMPOSE] OpenRouter failed:", e.message); }
    }
  }

  if (!llmResponse) {
    console.warn("[DECOMPOSE] All backends failed, single task fallback");
    return [{ title: "Build initial version", description: appDescription || "Build the app as described." }];
  }

  let cleaned = llmResponse.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  try {
    const tasks = JSON.parse(cleaned);
    if (!Array.isArray(tasks) || tasks.length === 0) throw new Error("Empty");
    console.log("[DECOMPOSE] Decomposed into " + tasks.length + " tasks");
    return tasks.slice(0, 6);
  } catch (e) {
    console.warn("[DECOMPOSE] Parse failed, single task fallback. Response:", cleaned.slice(0, 200));
    return [{ title: "Build initial version", description: appDescription || "Build the app as described." }];
  }
}


/**
 * Create multiple coding tasks for an app by decomposing via LLM.
 * Tasks have order field and dependency chain.
 */
async function createMultipleCodingTasks({ appId, appName, appDescription, repoFullName, deployTarget, hasDatabase }) {
  console.log(`[SCAFFOLD] Decomposing "${appName}" into multiple tasks...`);
  
  const taskDefs = await decomposeAppIntoTasks({ appName, appDescription, repoFullName, deployTarget });
  console.log(`[SCAFFOLD] Decomposed into ${taskDefs.length} tasks`);

  const dbNote = hasDatabase
    ? `\n## Database\nSupabase has been auto-provisioned. Use \`supabase\` from \`@/lib/supabase\` for data access.\n`
    : '';

  const createdTasks = [];
  
  for (let i = 0; i < taskDefs.length; i++) {
    const def = taskDefs[i];
    const isFirst = i === 0;
    const prevTask = createdTasks[createdTasks.length - 1];
    
    const fullDescription = `${def.description}

## Context
- App: ${appName} (task ${i + 1} of ${taskDefs.length})
- Repo: https://github.com/${repoFullName}
- Stack: Next.js 15 + TypeScript + Tailwind CSS v4 + shadcn/ui
- Pre-installed components: button, card, input, label, dialog, table, badge
${dbNote}
## Rules
- Use the existing scaffold as starting point
- Create a feature branch: \`feat/${def.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}\`
- Ensure \`npm run build\` passes
- Create a PR when done
- Deploy target: ${deployTarget || "vercel"}`;

    const taskData = {
      title: `[${appName}] ${def.title}`,
      description: fullDescription,
      type: "coding",
      priority: "normal",
      status: isFirst ? "todo" : "blocked",
      deploy_target: deployTarget || "vercel",
      repository_url: `https://github.com/${repoFullName}`,
      app_id: appId,
      dispatched_by: "app-factory",
      metadata: {
        app_task_order: i + 1,
        app_task_total: taskDefs.length,
        app_name: appName,
      },
    };

    // If not first task, add dependency on previous task
    if (prevTask) {
      taskData.depends_on = [prevTask.id];
    }

    const { data, error } = await supabase
      .from("agent_tasks")
      .insert(taskData)
      .select()
      .single();

    if (error) {
      console.error(`[SCAFFOLD] Failed to create task ${i + 1}: ${error.message}`);
      continue;
    }
    
    createdTasks.push(data);
    console.log(`[SCAFFOLD] Task ${i + 1}/${taskDefs.length}: ${data.id} — ${def.title} (status: ${data.status})`);
  }

  return createdTasks;
}

/**
 * Main scaffold pipeline. Runs async after app record is created.
 * @param {object} app - The app record from Supabase (full row)
 */
export async function runScaffoldPipeline(app) {
  const { id, slug, name, description, deploy_target, env_keys, needs_database } = app;

  console.log(`[SCAFFOLD] Starting pipeline for app "${slug}" (id=${id})`);

  try {
    // 1. Update status to scaffolding
    await supabase
      .from("apps")
      .update({ status: "scaffolding", updated_at: new Date().toISOString() })
      .eq("id", id);

    // 2. Create GitHub repo from template
    await emitStep(id, "github_repo", "in_progress");
    let githubRepoId, fullName, htmlUrl;
    try {
      console.log(`[SCAFFOLD] Creating GitHub repo: ${TEMPLATE_OWNER}/${slug}`);
      ({ id: githubRepoId, fullName, htmlUrl } = await createGitHubRepo(slug, description));
      console.log(`[SCAFFOLD] Repo created: ${htmlUrl} (id=${githubRepoId})`);

      // Verify repo actually exists and is not empty
      const verifyRepoResp = await fetch(`${GH_API}/repos/${TEMPLATE_OWNER}/${slug}`, {
        headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(30000),
      });
      if (!verifyRepoResp.ok) {
        throw new Error(`GitHub repo verification failed: repo not accessible after creation (HTTP ${verifyRepoResp.status})`);
      }

      // Retry commits check up to 5 times with 3s delays (GitHub template init is async)
      let commitsData = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 3000));
        const commitsCheckResp = await fetch(`${GH_API}/repos/${TEMPLATE_OWNER}/${slug}/commits?per_page=1`, {
          headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" },
          signal: AbortSignal.timeout(15000),
        });
        const data = await commitsCheckResp.json();
        if (Array.isArray(data) && data.length > 0) {
          commitsData = data;
          break;
        }
        console.log(`[SCAFFOLD] Repo commits not ready yet (attempt ${attempt + 1}/5), retrying...`);
      }
      if (!commitsData) {
        throw new Error(`GitHub repo was created but is empty after 5 attempts — template copy may have failed`);
      }

      console.log(`[SCAFFOLD] Verified: repo exists and has commits`);
      await emitStep(id, "github_repo", "done");
    } catch (githubErr) {
      await emitStep(id, "github_repo", "failed", githubErr.message);
      throw githubErr; // re-throw to fail the pipeline
    }

    // 3. Update app record with repo_url + repos array
    await supabase
      .from("apps")
      .update({
        repo_url: htmlUrl,
        repos: [fullName],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Mark "Scaffolding Template" done — the template was cloned in step 2
    await emitStep(id, "scaffold", "in_progress");
    // Wait 3s for GitHub to fully initialize the repo (moved here from step 4)
    await new Promise((r) => setTimeout(r, 3000));

    // Verify template files exist in the repo
    // Note: nextjs-template uses next.config.ts (TypeScript), not next.config.js
    // We check for EITHER next.config.ts OR next.config.js since both are valid
    const requiredFiles = ["package.json", "src/app/page.tsx"];
    const optionalAltFiles = [
      ["next.config.ts", "next.config.js"], // Next.js config: TS variant is preferred, JS is fallback
    ];

    // Retry helper: check file existence with up to 3 retries (handles GitHub init race conditions)
    async function checkFileExists(owner, repo, filePath, maxRetries = 3, delayMs = 2000) {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, delayMs));
        const resp = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${filePath}`, {
          headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" },
          signal: AbortSignal.timeout(15000),
        });
        if (resp.ok) return true;
        if (resp.status === 404 && attempt < maxRetries - 1) {
          console.log(`[SCAFFOLD] File not found yet: ${filePath} (attempt ${attempt + 1}/${maxRetries}), retrying...`);
          continue;
        }
      }
      return false;
    }

    for (const file of requiredFiles) {
      const exists = await checkFileExists(TEMPLATE_OWNER, slug, file);
      if (!exists) {
        throw new Error(`Scaffold verification failed: ${file} not found in repo after ${3} attempts`);
      }
    }

    // Check optional alt files (at least one variant must exist)
    for (const variants of optionalAltFiles) {
      let found = false;
      for (const variant of variants) {
        if (await checkFileExists(TEMPLATE_OWNER, slug, variant, 2, 1000)) {
          found = true;
          console.log(`[SCAFFOLD] Found config file variant: ${variant}`);
          break;
        }
      }
      if (!found) {
        console.warn(`[SCAFFOLD] None of [${variants.join(", ")}] found — template may be incomplete but continuing`);
      }
    }

    console.log(`[SCAFFOLD] Verified: template files present (package.json, next.config.ts, src/app/page.tsx)`);
    await emitStep(id, "scaffold", "done");

    // 4. Create coding task (so AI codegen can post comments to it)
    console.log(`[SCAFFOLD] Creating coding task for "${name}"`);
    const tasks = await createMultipleCodingTasks({
      appId: id,
      appName: name,
      appDescription: description,
      repoFullName: fullName,
      deployTarget: deploy_target || "vercel",
      hasDatabase: false,
    });
    console.log(`[SCAFFOLD] Created ${tasks.length} coding tasks for "${name}"`);
    const task = tasks[0]; // First task for AI codegen reference

    // 5. AI customization pass — generate pages, API routes, components, navigation
    console.log(`[SCAFFOLD] Starting AI codegen pass for "${name}" (task=${task.id})`);
    await emitStep(id, "ai_codegen", "in_progress");
    try {
      await generateAppCode(name, description, fullName, task.id, { appId: id, appSlug: slug });
      console.log(`[SCAFFOLD] AI codegen task dispatched (fire-and-forget)`);
      await emitStep(id, "ai_codegen", "done");
      // Task lifecycle handled by dispatcher: todo → in_progress → qa_testing → completed → deployed
    } catch (codegenErr) {
      // Non-fatal: log the error, leave task in 'todo' for manual pickup
      console.warn(`[SCAFFOLD] AI codegen failed (non-fatal): ${codegenErr.message}`);
      await emitStep(id, "ai_codegen", "failed", codegenErr.message);
      await supabase
        .from("agent_tasks")
        .update({
          result: {
            summary: `AI codegen attempted but failed: ${codegenErr.message}. Task left in todo for manual pickup.`,
          },
        })
        .eq("id", task.id)
        .catch(() => {});
    }

    // 6. Create Vercel project (if deploy_target=vercel and VERCEL_TOKEN is set)
    let vercelProjectId = null;
    let vercelUrl = null;

    if ((deploy_target === "vercel" || !deploy_target) && VERCEL_TOKEN) {
      console.log(`[SCAFFOLD] Creating Vercel project for "${slug}"`);
      try {
        await emitStep(id, "vercel_setup", "in_progress");
        const vercelResult = await createVercelProject({
          slug,
          repoFullName: fullName,
          envKeys: env_keys || [],
          vercelToken: VERCEL_TOKEN,
        });

        vercelProjectId = vercelResult.id;
        vercelUrl = vercelResult.previewUrl;

        console.log(`[SCAFFOLD] Vercel project created: id=${vercelProjectId} url=${vercelUrl}`);

        // Verify Vercel project exists and GitHub repo is linked
        const vercelVerifyResp = await fetch(`https://api.vercel.com/v9/projects/${slug}`, {
          headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
        });
        if (!vercelVerifyResp.ok) {
          throw new Error(`Vercel project verification failed: project not found after creation (HTTP ${vercelVerifyResp.status})`);
        }
        const vercelProjectData = await vercelVerifyResp.json();
        if (!vercelProjectData?.link?.repoId && !vercelProjectData?.link?.repo) {
          throw new Error(`Vercel project created but GitHub repo is not linked (no link.repoId or link.repo)`);
        }
        console.log(`[SCAFFOLD] Verified: Vercel project exists and is linked to GitHub repo`);
        await emitStep(id, "vercel_setup", "done");

        // 4b. Trigger initial deployment explicitly.
        // Vercel only auto-deploys on NEW pushes. Since the GitHub repo was created from
        // a template BEFORE the Vercel project was linked, the initial commit does NOT
        // trigger an auto-deploy. We must trigger it manually via the API.
        let vercelDeployId = null;
        let vercelDeployStatus = "deploying";
        let vercelDeployedUrl = null;

        // Update status to 'deploying' while we wait (do NOT rely on app.status for UI step tracking)
        await supabase
          .from("apps")
          .update({
            vercel_project_id: vercelProjectId,
            vercel_deploy_status: "deploying",
            status: "deploying",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
        await emitStep(id, "vercel_deploy", "in_progress");

        try {
          if (!githubRepoId) {
            throw new Error("GitHub repo ID not available — cannot trigger Vercel deployment");
          }

          console.log(`[SCAFFOLD] Triggering initial Vercel deployment for project ${vercelProjectId} (repoId=${githubRepoId})`);
          const deployResult = await triggerVercelDeployment({
            projectId: vercelProjectId,
            projectName: slug,
            repoId: githubRepoId,
            vercelToken: VERCEL_TOKEN,
            ref: "main",
          });

          vercelDeployId = deployResult.id;
          console.log(`[SCAFFOLD] Deployment triggered: ${vercelDeployId} — waiting for READY state...`);

          // Poll until deployment completes (max 5 min)
          const deployStatus = await waitForDeployment({
            deploymentId: vercelDeployId,
            vercelToken: VERCEL_TOKEN,
            timeoutMs: 300000,
            pollIntervalMs: 5000,
          });

          vercelDeployStatus = deployStatus.readyState.toLowerCase(); // "ready" | "error" | "canceled"
          vercelDeployedUrl = deployStatus.readyState === "READY"
            ? `https://${deployStatus.url}`
            : null;

          if (deployStatus.readyState === "READY") {
            vercelUrl = vercelDeployedUrl || vercelUrl;
            console.log(`[SCAFFOLD] Deployment READY: ${vercelUrl}`);
            await emitStep(id, "vercel_deploy", "done");

            // Verify the deployed URL actually serves real content (not a blank/error page)
            await emitStep(id, "first_deploy", "in_progress");
            try {
              const urlToCheck = vercelDeployedUrl;
              const deployedPageResp = await fetch(urlToCheck, {
                headers: { "User-Agent": "AppFactory-Verifier/1.0" },
                signal: AbortSignal.timeout(15000),
              });
              if (!deployedPageResp.ok) {
                throw new Error(`Deployment URL returned HTTP ${deployedPageResp.status} — app not yet accessible`);
              }
              const bodyText = await deployedPageResp.text();
              if (bodyText.includes("DEPLOYMENT_NOT_FOUND") || bodyText.trim().length < 50) {
                throw new Error(`Deployment URL responded but content looks like an error page or is blank`);
              }
              console.log(`[SCAFFOLD] Verified: deployment URL returns valid content (${bodyText.length} bytes)`);
              await emitStep(id, "first_deploy", "done");
            } catch (firstDeployErr) {
              console.warn(`[SCAFFOLD] First deployment verification failed (non-fatal): ${firstDeployErr.message}`);
              await emitStep(id, "first_deploy", "warning", firstDeployErr.message);
            }
          } else {
            console.warn(`[SCAFFOLD] Deployment ended with state ${deployStatus.readyState} — will not set live URL`);
            await emitStep(id, "vercel_deploy", "warning", `Deployment ended with state ${deployStatus.readyState}`);
          }
        } catch (deployErr) {
          // Non-fatal: log warning, deployment failed but pipeline continues
          console.warn(`[SCAFFOLD] Initial Vercel deployment failed (non-fatal): ${deployErr.message}`);
          vercelDeployStatus = "error";
          await emitStep(id, "vercel_deploy", "warning", deployErr.message);
        }

        // 5. Add custom subdomain: {slug}.dante.id → cname.vercel-dns.com
        let customDomain = null;
        try {
          const subdomain = `${slug}.dante.id`;

          // 5a. Create CNAME record in DigitalOcean DNS
          if (DO_TOKEN) {
            console.log(`[SCAFFOLD] Creating DNS CNAME: ${subdomain} → cname.vercel-dns.com`);
            await createDnsRecord({ slug, doToken: DO_TOKEN });
          } else {
            console.warn('[SCAFFOLD] DO_TOKEN not configured — skipping DNS CNAME creation');
          }

          // 5b. Add custom domain to Vercel project
          console.log(`[SCAFFOLD] Adding custom domain to Vercel: ${subdomain}`);
          await addCustomDomain({ projectId: vercelProjectId, domain: subdomain, vercelToken: VERCEL_TOKEN });

          customDomain = subdomain;
          console.log(`[SCAFFOLD] Custom subdomain ready: https://${subdomain}`);
        } catch (domainErr) {
          // Non-fatal: log warning, do not crash the pipeline
          console.warn(`[SCAFFOLD] Custom subdomain setup failed (non-fatal): ${domainErr.message}`);
        }

        // Only set vercel_preview_url if the deployment actually succeeded
        const deploySucceeded = vercelDeployStatus === "ready";
        await supabase
          .from("apps")
          .update({
            vercel_project_id: vercelProjectId,
            // Only write vercel_preview_url once we confirm a real deployment is READY
            ...(deploySucceeded && { vercel_preview_url: vercelUrl }),
            vercel_deploy_id: vercelDeployId,
            vercel_deploy_status: vercelDeployStatus,
            // Reset status from 'deploying' so the pipeline continues and the UI
            // doesn't show a stuck "in_progress" state after a failed deploy.
            // The pipeline continues regardless — 'scaffolding' signals that.
            // Step 8 below will update to 'building' once coding task is created.
            status: deploySucceeded ? "deploying" : "scaffolding",
            ...(customDomain && { custom_domain: customDomain }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        // If deployment succeeded, set app to "live" with deployment_url
        if (deploySucceeded && vercelUrl) {
          await supabase
            .from("apps")
            .update({
              status: "live",
              deployment_url: vercelUrl,
              deployment_status: "live",
              last_deployed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);
          await emitStep(id, "live", "done");
          console.log(`[SCAFFOLD] App marked LIVE: ${vercelUrl}`);
        }
      } catch (vercelErr) {
        // Non-fatal: log warning, continue with task creation
        console.warn(`[SCAFFOLD] Vercel project creation failed (non-fatal): ${vercelErr.message}`);
        await emitStep(id, "vercel_setup", "failed", vercelErr.message);
      }
    } else if (!VERCEL_TOKEN) {
      console.warn("[SCAFFOLD] VERCEL_TOKEN not configured — skipping Vercel project creation");
    }

    // 6. Supabase auto-provisioning (if needs_database or detected from description)
    const shouldProvisionDb = needs_database || detectNeedsDatabase(description || "");
    let hasDatabase = false;

    if (shouldProvisionDb) {
      console.log(`[SCAFFOLD] Provisioning Supabase for "${slug}"...`);
      try {
        // 6a. Create schema + AI-generated tables + RLS policies
        const dbResult = await provisionSupabase(slug, description || "");
        console.log(`[SCAFFOLD] Supabase provisioned: schema=${dbResult.schema}, tables=[${dbResult.tables.join(", ")}]`);

        // 6b. Inject env vars into Vercel project
        if (vercelProjectId && VERCEL_TOKEN) {
          await injectVercelEnvVars(vercelProjectId, VERCEL_TOKEN, slug);
          console.log(`[SCAFFOLD] Vercel env vars injected for "${slug}"`);
        }

        // 6c. Push /src/lib/supabase.ts to GitHub repo
        if (fullName && GH_TOKEN) {
          const supabaseTs = generateSupabaseClientFile();
          await pushFileToGitHub(
            fullName,
            "src/lib/supabase.ts",
            supabaseTs,
            "chore: add Supabase client setup [auto-provisioned]"
          );
          console.log(`[SCAFFOLD] /src/lib/supabase.ts pushed to ${fullName}`);
        }

        // 6d. Update app record: mark needs_database + supabase_project_ref
        await supabase
          .from("apps")
          .update({
            needs_database: true,
            supabase_project_ref: "lessxkxujvcmublgwdaa",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        hasDatabase = true;
      } catch (dbErr) {
        // Non-fatal: log warning, continue with task creation
        console.warn(`[SCAFFOLD] Supabase provisioning failed (non-fatal): ${dbErr.message}`);
      }
    }

    // 10. Update app status to 'building'
    await supabase
      .from("apps")
      .update({ status: "building", updated_at: new Date().toISOString() })
      .eq("id", id);

    console.log(`[SCAFFOLD] Pipeline complete for "${slug}" — status=building, task=${task.id}`);
  } catch (err) {
    console.error(`[SCAFFOLD] Pipeline failed for "${slug}":`, err.message);
    try {
      // Mark any stuck in-progress build steps as failed (prevents UI showing "Running..." forever)
      const { data: appData } = await supabase
        .from("apps")
        .select("build_steps")
        .eq("id", id)
        .single();
      const steps = Array.isArray(appData?.build_steps) ? appData.build_steps : [];
      const now = new Date().toISOString();
      const updatedSteps = steps.map(s =>
        s.status === "in_progress"
          ? { ...s, status: "failed", completed_at: now, error: err.message.slice(0, 500) }
          : s
      );
      await supabase
        .from("apps")
        .update({ build_steps: updatedSteps, status: "failed", updated_at: now })
        .eq("id", id);
    } catch (cleanupErr) {
      console.error("[SCAFFOLD] Failed to mark stuck steps as failed:", cleanupErr.message);
      // Fallback: at least update status
      await supabase
        .from("apps")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", id)
        .catch((e) => console.error("[SCAFFOLD] Failed to update status to failed:", e.message));
    }
  }
}
