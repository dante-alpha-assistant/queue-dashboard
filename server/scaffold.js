// server/scaffold.js — App Factory scaffold pipeline
// Triggered AFTER the app record is created in the DB.
//
// Sequence:
//   1. Update app status → 'scaffolding'
//   2. Create GitHub repo from dante-alpha-assistant/nextjs-template
//   3. Wait briefly for GitHub to initialize the repo (3s)
//   4. Create Vercel project linked to GitHub repo (if deploy_target=vercel)
//   5. Add custom subdomain {slug}.dante.id via DigitalOcean DNS + Vercel domain API
//   6. Supabase auto-provisioning (if needs_database=true or detected from description)
//      a. Create schema + AI-generated tables + RLS policies
//      b. Inject env vars into Vercel project
//      c. Push /src/lib/supabase.ts to GitHub repo
//   7. Update app record: repo_url, vercel_project_id, vercel_preview_url, custom_domain
//   8. Auto-create coding task in agent_tasks (picked up by neo-worker)
//   9. Update app status → 'building'
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
async function createCodingTask({ appId, appName, appDescription, repoFullName, deployTarget, hasDatabase }) {
  const dbNote = hasDatabase
    ? `\n## Database\nSupabase has been auto-provisioned for this app:\n- Schema: \`${repoFullName.split('/')[1]}\`\n- Client: \`/src/lib/supabase.ts\` (already pushed to repo)\n- Env vars: injected into Vercel automatically\n- Use \`supabase\` from \`@/lib/supabase\` for data access\n`
    : '';

  const taskDescription = `Build the initial version of the ${appName} app.

## App Description
${appDescription || "No description provided."}

## Repo
https://github.com/${repoFullName}

## Requirements
- Build custom pages and routes based on the app description above
- Use the existing Next.js 15 + shadcn/ui scaffold as the starting point
- Create meaningful UI pages that match the app's purpose
- Add any required API routes in /src/app/api/
- Ensure the app builds successfully (npm run build)
- Create a PR when done
${dbNote}
## What the AI generates (automated pass)
The App Factory AI codegen pass will also run automatically to:
- Create domain-specific pages and routes based on the app description
- Generate /src/app/api/ endpoints for CRUD operations
- Build a sidebar/header navigation layout
- Create reusable domain-specific components using shadcn/ui

## Deploy Target
${deployTarget || "vercel"}

## Notes
- The repo was scaffolded from ${TEMPLATE_OWNER}/${TEMPLATE_REPO}
- Stack: Next.js 15 + TypeScript + Tailwind CSS v4 + shadcn/ui (new-york style, zinc)
- Pre-installed components: button, card, input, label, dialog, table, badge
- Supabase client is set up in /src/lib/supabase.ts (env vars pre-configured in Vercel)
- AI codegen runs immediately after scaffold — a PR will be opened automatically
- If AI codegen fails, this task remains in 'todo' for manual pickup`;

  const { data, error } = await supabase
    .from("agent_tasks")
    .insert({
      title: `Build initial version of ${appName}`,
      description: taskDescription,
      type: "coding",
      priority: "normal",
      status: "todo",
      deploy_target: deployTarget || "vercel",
      repository_url: `https://github.com/${repoFullName}`,
      app_id: appId,
      dispatched_by: "app-factory",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create coding task: ${error.message}`);
  return data;
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
    console.log(`[SCAFFOLD] Creating GitHub repo: ${TEMPLATE_OWNER}/${slug}`);
    const { id: githubRepoId, fullName, htmlUrl } = await createGitHubRepo(slug, description);
    console.log(`[SCAFFOLD] Repo created: ${htmlUrl} (id=${githubRepoId})`);

    // Verify repo actually exists and is not empty
    const verifyRepoResp = await fetch(`${GH_API}/repos/${TEMPLATE_OWNER}/${slug}`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" },
    });
    if (!verifyRepoResp.ok) {
      throw new Error(`GitHub repo verification failed: repo not accessible after creation (HTTP ${verifyRepoResp.status})`);
    }
    const commitsCheckResp = await fetch(`${GH_API}/repos/${TEMPLATE_OWNER}/${slug}/commits?per_page=1`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" },
    });
    const commitsData = await commitsCheckResp.json();
    if (!Array.isArray(commitsData) || commitsData.length === 0) {
      throw new Error(`GitHub repo was created but is empty — template copy may have failed`);
    }
    console.log(`[SCAFFOLD] Verified: repo exists and has commits`);
    await emitStep(id, "github_repo", "done");

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
    const templateFiles = ["package.json", "next.config.js", "src/app/page.tsx"];
    for (const file of templateFiles) {
      const fileCheckResp = await fetch(`${GH_API}/repos/${TEMPLATE_OWNER}/${slug}/contents/${file}`, {
        headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" },
      });
      if (!fileCheckResp.ok) {
        throw new Error(`Scaffold verification failed: ${file} not found in repo (HTTP ${fileCheckResp.status})`);
      }
    }
    console.log(`[SCAFFOLD] Verified: template files present (package.json, next.config.js, src/app/page.tsx)`);
    await emitStep(id, "scaffold", "done");

    // 4. Create Vercel project (if deploy_target=vercel and VERCEL_TOKEN is set)
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

    // 7. Auto-create coding task
    console.log(`[SCAFFOLD] Creating coding task for "${name}"`);
    const task = await createCodingTask({
      appId: id,
      appName: name,
      appDescription: description,
      repoFullName: fullName,
      deployTarget: deploy_target || "vercel",
      hasDatabase,
    });
    console.log(`[SCAFFOLD] Coding task created: ${task.id}`);

    // 8. Update app status to 'building'
    await supabase
      .from("apps")
      .update({ status: "building", updated_at: new Date().toISOString() })
      .eq("id", id);

    // 7. AI customization pass — generate pages, API routes, components, navigation
    console.log(`[SCAFFOLD] Starting AI codegen pass for "${name}" (task=${task.id})`);
    await emitStep(id, "ai_codegen", "in_progress");
    try {
      const { prUrl, fileCount } = await generateAppCode(name, description, fullName, task.id);
      console.log(`[SCAFFOLD] AI codegen done — ${fileCount} files, PR: ${prUrl}`);

      await emitStep(id, "ai_codegen", "done");
      // Mark coding task as qa_testing and store the PR URL
      await supabase
        .from("agent_tasks")
        .update({
          status: "qa_testing",
          pull_request_url: [prUrl],
          completed_at: new Date().toISOString(),
          result: {
            summary: `AI generated ${fileCount} files for ${name}. PR: ${prUrl}`,
            artifacts: [{ type: "pr", url: prUrl }],
          },
        })
        .eq("id", task.id);
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

    console.log(`[SCAFFOLD] Pipeline complete for "${slug}" — status=building, task=${task.id}`);
  } catch (err) {
    console.error(`[SCAFFOLD] Pipeline failed for "${slug}":`, err.message);
    // Update app status to failed
    await supabase
      .from("apps")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .catch((e) => console.error("[SCAFFOLD] Failed to update status to failed:", e.message));
  }
}
