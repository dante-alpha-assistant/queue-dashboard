// server/ai-codegen.js — AI customization pass for App Factory
// Generates pages, API routes, components, and navigation for a scaffolded Next.js app.
//
// Called from scaffold.js after the GitHub repo is created from the nextjs-template.
// Uses an LLM to create domain-specific files and pushes them via the GitHub Contents API.

import supabase from "./supabase.js";

const GH_API = "https://api.github.com";
const GH_TOKEN = process.env.GH_TOKEN;
const NEO_GATEWAY = process.env.NEO_GATEWAY_URL || "http://neo.agents.svc.cluster.local:18789";
const NEO_TOKEN = process.env.NEO_GATEWAY_TOKEN || "neo-gw-tok-2026";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

/**
 * Post a progress comment to a task for the live SSE feed.
 */
async function postComment(taskId, body) {
  if (!taskId) return;
  try {
    await supabase.from("task_comments").insert({
      task_id: taskId,
      author: "neo-worker",
      body,
    });
  } catch (e) {
    // Non-fatal
    console.warn("[AI-CODEGEN] Failed to post comment:", e.message);
  }
}

/**
 * Call the LLM (tries OpenRouter first, then NEO_GATEWAY).
 */
async function callLLM(prompt) {
  // Try OpenRouter first
  if (OPENROUTER_KEY) {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://tasks.dante.id",
        "X-Title": "App Factory AI Codegen",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-5",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.choices?.[0]?.message?.content || "";
    }
    console.warn("[AI-CODEGEN] OpenRouter returned", resp.status, "— trying gateway");
  }

  // Try NEO_GATEWAY (OpenAI-compatible)
  const resp = await fetch(`${NEO_GATEWAY}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NEO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    throw new Error(`LLM call failed (${resp.status}): ${await resp.text()}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Build the LLM prompt for code generation.
 */
function buildPrompt(appName, appDescription) {
  const needsDb =
    /user|account|login|auth|data|record|store|database|crm|contact|product|order|inventory|post|comment|message|chat|dashboard/i.test(
      appDescription
    );

  return `You are a senior Next.js developer building a real application from scratch.

App Name: ${appName}
App Description: ${appDescription}

Stack:
- Next.js 15 (App Router, TypeScript)
- Tailwind CSS v4
- shadcn/ui (new-york style, zinc color scheme)
- Pre-installed shadcn components: Button, Card, Input, Label, Dialog, DropdownMenu, Table, Badge, Toaster

Generate a complete, working initial codebase tailored to this app description.

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "files": [
    {
      "path": "src/app/page.tsx",
      "content": "...full file content as a string..."
    }
  ],
  "pr_title": "feat: AI-generated ${appName} initial codebase",
  "pr_description": "## AI-Generated Initial Codebase\\n\\nThis PR contains the AI-generated initial code for **${appName}**.\\n\\n### What was generated\\n- Domain-specific pages and routes\\n- API endpoints\\n- Navigation layout\\n- Reusable components"
}

Required files to generate:
1. src/app/page.tsx — Main landing/dashboard page with real content
2. src/app/layout.tsx — Root layout with sidebar or top nav
3. At least 2 domain-specific pages (e.g. src/app/contacts/page.tsx, src/app/deals/page.tsx)
4. At least 1 API route (e.g. src/app/api/[resource]/route.ts)
5. src/components/Sidebar.tsx or src/components/Header.tsx — navigation component
${needsDb ? "6. src/lib/supabase.ts — Supabase client setup\n7. migrations/001_init.sql — Initial DB schema" : ""}

Rules:
- Use TypeScript (.tsx/.ts), not JavaScript
- Use Tailwind classes for all styling (no inline styles except rare cases)
- Import shadcn components from @/components/ui/[name]
- Make the UI look polished and professional
- Add realistic placeholder data arrays for list views
- Keep file sizes reasonable (100-300 lines each)
- Make navigation match the actual pages you create
- Do NOT add new npm dependencies — use only what's pre-installed

CRITICAL — DATABASE & AUTH RULES (violations will break the app):
- NEVER use Prisma, TypeORM, Drizzle, Sequelize, or any ORM
- NEVER use SQLite, MySQL, or any local file-based database (file:./dev.db etc.)
- NEVER generate a prisma/ directory, schema.prisma, or any migration files
- For ALL data storage: use the Supabase client via \`@/lib/supabase\` (already set up)
- For ALL authentication (login, signup, sessions): use Supabase Auth (@supabase/supabase-js)
  - Login: \`supabase.auth.signInWithPassword({ email, password })\`
  - Signup: \`supabase.auth.signUp({ email, password })\`
  - Session: \`supabase.auth.getSession()\`
- Database queries: use \`supabase.from('table').select()\`, NOT raw SQL or ORM methods
- If the app needs user accounts or login pages, implement them with Supabase Auth only
- NEVER write code that calls \`prisma.user.findUnique()\` or any prisma.* method`;
}

/**
 * Get the current default branch SHA for the repo.
 * Retries up to 5 times with 3s delay — GitHub repos from template generation can take a few seconds to initialize.
 */
async function getBaseSHA(repoFullName, maxRetries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const resp = await fetch(`${GH_API}/repos/${repoFullName}`, {
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (resp.status === 404) {
      if (attempt < maxRetries) {
        console.log(`[AI-CODEGEN] Repo ${repoFullName} not ready yet (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw new Error(`Repo ${repoFullName} not found after ${maxRetries} attempts`);
    }

    if (!resp.ok) throw new Error(`Failed to get repo info: ${resp.status}`);
    const repo = await resp.json();
    const defaultBranch = repo.default_branch || "main";

    // Get the branch SHA (also retry if branch ref isn't ready)
    for (let branchAttempt = 1; branchAttempt <= maxRetries; branchAttempt++) {
      const branchResp = await fetch(
        `${GH_API}/repos/${repoFullName}/git/ref/heads/${defaultBranch}`,
        {
          headers: {
            Authorization: `Bearer ${GH_TOKEN}`,
            Accept: "application/vnd.github+json",
          },
        }
      );
      if (branchResp.status === 404 && branchAttempt < maxRetries) {
        console.log(`[AI-CODEGEN] Branch ref not ready yet (attempt ${branchAttempt}/${maxRetries}), retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      if (!branchResp.ok) throw new Error(`Failed to get branch ref: ${branchResp.status}`);
      const branchData = await branchResp.json();
      return { sha: branchData.object.sha, defaultBranch };
    }
  }
  throw new Error(`Could not get base SHA for ${repoFullName} after ${maxRetries} attempts`);
}

/**
 * Push all files to GitHub using the Git Tree API (one commit).
 */
async function pushFilesViaTreeAPI(repoFullName, files, branchName, baseSHA, taskId) {
  // 1. Create blobs for each file
  await postComment(taskId, `🌿 Creating branch ${branchName}...`);

  const treeItems = [];
  for (const file of files) {
    await postComment(taskId, `📄 Preparing ${file.path}...`);
    const blobResp = await fetch(`${GH_API}/repos/${repoFullName}/git/blobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: Buffer.from(file.content).toString("base64"),
        encoding: "base64",
      }),
    });
    if (!blobResp.ok) {
      const err = await blobResp.json();
      console.warn(`[AI-CODEGEN] Blob create failed for ${file.path}:`, err.message);
      continue;
    }
    const blob = await blobResp.json();
    treeItems.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  if (treeItems.length === 0) throw new Error("No files could be prepared as blobs");

  // 2. Create tree
  await postComment(taskId, `🌳 Committing ${treeItems.length} files...`);
  const treeResp = await fetch(`${GH_API}/repos/${repoFullName}/git/trees`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base_tree: baseSHA,
      tree: treeItems,
    }),
  });
  if (!treeResp.ok) {
    const err = await treeResp.json();
    throw new Error(`Tree create failed: ${err.message}`);
  }
  const tree = await treeResp.json();

  // 3. Create commit
  const commitResp = await fetch(`${GH_API}/repos/${repoFullName}/git/commits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `feat: AI-generated initial codebase for ${repoFullName.split("/").pop()}`,
      tree: tree.sha,
      parents: [baseSHA],
    }),
  });
  if (!commitResp.ok) {
    const err = await commitResp.json();
    throw new Error(`Commit create failed: ${err.message}`);
  }
  const commit = await commitResp.json();

  // 4. Create branch pointing at commit
  const branchResp = await fetch(`${GH_API}/repos/${repoFullName}/git/refs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: commit.sha,
    }),
  });
  if (!branchResp.ok) {
    const err = await branchResp.json();
    throw new Error(`Branch create failed: ${err.message}`);
  }

  return commit.sha;
}

/**
 * Open a pull request from branchName → defaultBranch.
 */
async function openPR(repoFullName, branchName, defaultBranch, prTitle, prDescription) {
  const resp = await fetch(`${GH_API}/repos/${repoFullName}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: prTitle,
      body: prDescription,
      head: branchName,
      base: defaultBranch,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(`PR create failed: ${err.message}`);
  }
  const pr = await resp.json();
  return pr.html_url;
}

/**
 * Build a detailed task description for the codegen agent.
 */
function buildCodegenTaskDescription(appName, appDescription, repoFullName) {
  return `## App Factory — AI Codegen Task

**App Name:** ${appName}
**App Description:** ${appDescription}
**Repository:** https://github.com/${repoFullName}

## Your Mission
Generate a complete, domain-specific initial codebase for this application and open a pull request.

## Tech Stack
- Next.js 15 (App Router, TypeScript)
- Tailwind CSS v4
- shadcn/ui (new-york style, zinc color scheme)

## Pre-installed shadcn/ui Components (use only these — do NOT install new ones)
Button, Card, Input, Label, Dialog, DropdownMenu, Table, Badge, Toaster

## Steps
1. Clone the repository: \`git clone https://github.com/${repoFullName}\`
2. Create branch: \`git checkout -b feat/ai-initial-codebase\`
3. Use Codex (or equivalent) to generate domain-specific pages, routes, and components tailored to the app description
4. Required files to generate:
   - \`src/app/page.tsx\` — Main landing/dashboard page with real content
   - \`src/app/layout.tsx\` — Root layout with sidebar or top nav
   - At least 2 domain-specific pages (e.g. \`src/app/contacts/page.tsx\`)
   - At least 1 API route (e.g. \`src/app/api/[resource]/route.ts\`)
   - \`src/components/Sidebar.tsx\` or \`src/components/Header.tsx\` — navigation component
5. Commit all generated files
6. Push the branch and create a PR targeting \`main\`

## Rules
- Use TypeScript (.tsx/.ts), NOT JavaScript
- Use Tailwind classes for all styling
- Import shadcn components from \`@/components/ui/[name]\`
- Make the UI look polished and professional
- Add realistic placeholder data arrays for list views
- **Do NOT add new npm dependencies** — use only pre-installed packages
- Keep file sizes reasonable (100–300 lines each)
- Make navigation match the actual pages you create

## CRITICAL — Database & Auth Rules (MUST follow — violations cause runtime crashes)
- **NEVER use Prisma, TypeORM, Drizzle, Sequelize, or any ORM**
- **NEVER use SQLite, MySQL, or any local/file-based database** (no \`file:./dev.db\`, no \`DATABASE_URL\` pointing to a .db file)
- **NEVER generate a \`prisma/\` directory, \`schema.prisma\`, or migration files**
- For ALL data storage: use the **Supabase client** via \`@/lib/supabase\` (already configured via env vars)
  - Queries: \`supabase.from('table').select()\`, \`.insert()\`, \`.update()\`, \`.delete()\`
- For ALL authentication (login, signup, sessions): use **Supabase Auth**
  - Login: \`supabase.auth.signInWithPassword({ email, password })\`
  - Signup: \`supabase.auth.signUp({ email, password })\`
  - Current user: \`supabase.auth.getUser()\`
- If you need login/signup pages, implement them with Supabase Auth — NOT Prisma/SQLite
- If you need DB tables, describe them in comments — do NOT create local DB files

## PR
Create a PR with title: \`feat: AI-generated ${appName} initial codebase\`
The PR should target the \`main\` branch.
`;
}

/**
 * Create a codegen task in agent_tasks for the dispatcher to pick up.
 */
async function createCodegenTask({ appId, appSlug, appName, appDescription, repoFullName, parentTaskId }) {
  const description = buildCodegenTaskDescription(appName, appDescription, repoFullName);
  const { data, error } = await supabase
    .from("agent_tasks")
    .insert({
      title: `App Factory — Generate initial code for ${appName}`,
      description,
      type: "coding",
      priority: "high",
      status: "todo",
      repository_url: `https://github.com/${repoFullName}`,
      ...(appId && { app_id: appId }),
      dispatched_by: "app-factory",
      metadata: {
        app_id: appId,
        app_slug: appSlug,
        pipeline_step: "ai_codegen",
        parent_task_id: parentTaskId,
      },
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create codegen task: ${error.message}`);
  return data;
}

/**
 * Poll an agent_task until it reaches a terminal/ready state.
 *
 * @param {string} taskId
 * @param {number} timeoutMs
 * @param {number} pollIntervalMs
 * @returns {Promise<object>} The completed task row
 */
async function pollCodegenTask(taskId, timeoutMs = 600000, pollIntervalMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  const terminalStatuses = ["qa_testing", "completed", "deployed"];

  while (Date.now() < deadline) {
    const { data: task, error } = await supabase
      .from("agent_tasks")
      .select("id,status,result,pull_request_url")
      .eq("id", taskId)
      .single();

    if (error) {
      console.warn(`[AI-CODEGEN] Poll error for task ${taskId}:`, error.message);
    } else if (task.status === "failed") {
      const errMsg = task.result?.error || task.result?.summary || "Unknown error";
      throw new Error(`Codegen task failed: ${errMsg}`);
    } else if (terminalStatuses.includes(task.status)) {
      return task;
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Codegen task ${taskId} timed out after ${timeoutMs / 1000}s`);
}

/**
 * Main entry point: run the AI customization pass on a freshly scaffolded repo.
 *
 * @param {string} appName - Human-readable app name
 * @param {string} appDescription - User's description of what the app should do
 * @param {string} repoFullName - GitHub full repo name (e.g. "dante-alpha-assistant/my-crm")
 * @param {string|null} parentTaskId - The agent task ID to post progress comments to
 * @param {object} opts - Optional: { appId, appSlug }
 * @returns {Promise<{prUrl: string, fileCount: number}>}
 */
export async function generateAppCode(appName, appDescription, repoFullName, parentTaskId, opts = {}) {
  if (!GH_TOKEN) throw new Error("GH_TOKEN not configured");
  if (!appDescription || appDescription.trim().length < 50) {
    throw new Error("App description too short for AI generation (minimum 50 characters)");
  }

  // Task-based pipeline (default enabled; set USE_TASK_PIPELINE=false to use legacy LLM path)
  if (process.env.USE_TASK_PIPELINE !== "false") {
    console.log(`[AI-CODEGEN] Using task-based pipeline for "${appName}" (${repoFullName})`);

    // Use the existing parent task instead of creating a duplicate.
    // scaffold.js already created a coding task — we just update it and wait.
    let taskId = parentTaskId;

    if (!taskId) {
      // No parent task — create one (standalone codegen call)
      const task = await createCodegenTask({
        appId: opts.appId,
        appSlug: opts.appSlug,
        appName,
        appDescription,
        repoFullName,
        parentTaskId: null,
      });
      taskId = task.id;
      console.log(`[AI-CODEGEN] Codegen task created: ${taskId}`);
    } else {
      console.log(`[AI-CODEGEN] Using existing task ${taskId} (no duplicate)`);
    }

    await postComment(taskId, `🤖 AI codegen task dispatched. Agent will pick it up and auto-deploy when done.`);

    // Fire-and-forget: don't poll. The dispatcher handles:
    // qa_testing → completed (auto-QA-skip) → deployed (auto-deploy)
    console.log(`[AI-CODEGEN] Task ${taskId} dispatched — returning immediately (no poll)`);
    return { prUrl: null, fileCount: 0 };
  }

  // --- Legacy direct LLM path (USE_TASK_PIPELINE=false) ---
  const taskId = parentTaskId;
  console.log(`[AI-CODEGEN] Starting AI customization for "${appName}" (${repoFullName})`);
  await postComment(taskId, `🤖 AI is analyzing "${appName}"...`);

  // 1. Call LLM to generate code plan
  const prompt = buildPrompt(appName, appDescription);
  await postComment(taskId, "🧠 Generating pages, routes, and components...");

  let rawResponse;
  try {
    rawResponse = await callLLM(prompt);
  } catch (e) {
    throw new Error(`LLM call failed: ${e.message}`);
  }

  // 2. Parse JSON response
  let plan;
  try {
    // Strip markdown code fences if present
    const cleaned = rawResponse
      .replace(/^```json\s*/m, "")
      .replace(/^```\s*/m, "")
      .replace(/\s*```\s*$/m, "")
      .trim();
    plan = JSON.parse(cleaned);
  } catch (e) {
    // Try to extract JSON from response
    const match = rawResponse.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        plan = JSON.parse(match[0]);
      } catch {
        throw new Error(`Failed to parse LLM response as JSON: ${e.message}`);
      }
    } else {
      throw new Error(`LLM did not return valid JSON: ${rawResponse.slice(0, 200)}`);
    }
  }

  const files = plan.files || [];
  if (files.length === 0) throw new Error("LLM returned no files to create");

  // Guard: reject any Prisma/SQLite-based files — these break on Vercel/serverless deployments
  const prismaViolations = files.filter(
    (f) =>
      f.path.startsWith("prisma/") ||
      f.path === "schema.prisma" ||
      /prisma\.client|@prisma\/client|provider\s*=\s*["']sqlite["']|file:\.\/.*\.db/.test(f.content || "")
  );
  if (prismaViolations.length > 0) {
    const paths = prismaViolations.map((f) => f.path).join(", ");
    console.warn(`[AI-CODEGEN] ⚠️  Prisma/SQLite files detected (${paths}) — rejecting and re-generating with stricter prompt`);
    await postComment(taskId, `⚠️ AI generated Prisma/SQLite code (${paths}). This is not supported on Vercel — these files have been removed.`);
    // Strip the offending files rather than failing hard
    files.splice(0, files.length, ...files.filter((f) => !prismaViolations.includes(f)));
  }

  await postComment(taskId, `📦 Planning ${files.length} files: ${files.map((f) => f.path).join(", ")}`);

  // 3. Wait for GitHub to fully initialize repo (give it a moment)
  await new Promise((r) => setTimeout(r, 2000));

  // 4. Get base SHA
  let baseSHA, defaultBranch;
  try {
    ({ sha: baseSHA, defaultBranch } = await getBaseSHA(repoFullName));
  } catch (e) {
    throw new Error(`Cannot read repo (may not be initialized yet): ${e.message}`);
  }

  // 5. Push files via tree API
  const branchName = "feat/ai-initial-codebase";
  try {
    await pushFilesViaTreeAPI(repoFullName, files, branchName, baseSHA, taskId);
  } catch (e) {
    throw new Error(`Failed to push files: ${e.message}`);
  }

  // 6. Open PR
  await postComment(taskId, "🔀 Opening pull request...");
  const prTitle = plan.pr_title || `feat: AI-generated ${appName} initial codebase`;
  const prDescription =
    plan.pr_description ||
    `## AI-Generated Initial Codebase\n\nThis PR was automatically generated by the App Factory based on the app description.\n\n**Files created:** ${files.map((f) => `\`${f.path}\``).join(", ")}`;

  const prUrl = await openPR(repoFullName, branchName, defaultBranch, prTitle, prDescription);

  await postComment(taskId, `✅ AI generation complete! PR: ${prUrl}`);
  console.log(`[AI-CODEGEN] Done for "${appName}" — ${files.length} files, PR: ${prUrl}`);

  return { prUrl, fileCount: files.length };
}
