// server/vercel.js — Vercel API integration for App Factory
// Handles automatic project creation when deploy_target=vercel

const VERCEL_API = "https://api.vercel.com";
// Vercel account/team slug for lautaro450
const VERCEL_TEAM_SLUG = "lautaro450";

/**
 * Creates a Vercel project, links it to a GitHub repo,
 * and seeds empty environment variable placeholders.
 *
 * @param {object} opts
 * @param {string} opts.slug - App slug (used as Vercel project name)
 * @param {string} opts.repoFullName - GitHub full repo name, e.g. 'dante-alpha-assistant/my-app'
 * @param {string[]} opts.envKeys - List of env var key names to create as empty plaintext entries
 * @param {string} opts.vercelToken - Vercel API bearer token
 * @returns {Promise<{id: string, previewUrl: string}>}
 */
export async function createVercelProject({ slug, repoFullName, envKeys = [], vercelToken }) {
  if (!vercelToken) throw new Error("VERCEL_TOKEN not configured");

  const headers = {
    Authorization: `Bearer ${vercelToken}`,
    "Content-Type": "application/json",
  };

  // Build env vars array — create empty plaintext entries so the Vercel project
  // knows which keys to expect (devs fill them in the Vercel dashboard)
  const environmentVariables = (envKeys || []).map((key) => ({
    key,
    value: "",
    type: "plain",
    target: ["production", "preview", "development"],
  }));

  const createBody = {
    name: slug,
    framework: "nextjs",
    gitRepository: {
      type: "github",
      repo: repoFullName,
    },
    ...(environmentVariables.length > 0 && { environmentVariables }),
  };

  // Use teamId query param to scope to the lautaro450 account
  const teamParam = `?teamId=${VERCEL_TEAM_SLUG}`;

  const resp = await fetch(`${VERCEL_API}/v10/projects${teamParam}`, {
    method: "POST",
    headers,
    body: JSON.stringify(createBody),
  });

  const data = await resp.json();

  if (!resp.ok) {
    // 409 = project already exists — fetch it and return its id
    if (
      resp.status === 409 ||
      (data.error && data.error.code === "project_already_exists")
    ) {
      const existingResp = await fetch(
        `${VERCEL_API}/v9/projects/${slug}${teamParam}`,
        { headers }
      );
      const existingData = await existingResp.json();
      if (existingResp.ok) {
        return {
          id: existingData.id,
          previewUrl: `https://${slug}.vercel.app`,
        };
      }
    }
    throw new Error(
      `Vercel API error (${resp.status}): ${data.error?.message || JSON.stringify(data)}`
    );
  }

  return {
    id: data.id,
    previewUrl: `https://${data.name}.vercel.app`,
  };
}

/**
 * Triggers an initial deployment for a Vercel project from a GitHub repo.
 * This is needed because Vercel only auto-deploys on NEW pushes — if the repo
 * was created from a template before the Vercel project was linked, the initial
 * commit does NOT trigger an automatic deployment.
 *
 * @param {object} opts
 * @param {string} opts.projectId - Vercel project ID
 * @param {string} opts.projectName - Vercel project name (slug)
 * @param {string|number} opts.repoId - GitHub numeric repo ID
 * @param {string} opts.vercelToken - Vercel API bearer token
 * @param {string} [opts.ref] - Git ref to deploy (default: "main")
 * @returns {Promise<{id: string, url: string, readyState: string}>}
 */
export async function triggerVercelDeployment({
  projectId,
  projectName,
  repoId,
  vercelToken,
  ref = "main",
}) {
  if (!vercelToken) throw new Error("VERCEL_TOKEN not configured");
  if (!repoId) throw new Error("repoId is required to trigger a Vercel deployment");

  const teamParam = `?teamId=${VERCEL_TEAM_SLUG}`;

  const body = {
    name: projectName,
    project: projectId,
    gitSource: {
      type: "github",
      repoId: String(repoId),
      ref,
    },
  };

  const resp = await fetch(`${VERCEL_API}/v13/deployments${teamParam}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(
      `Vercel deployment trigger error (${resp.status}): ${data.error?.message || JSON.stringify(data)}`
    );
  }

  console.log(
    `[VERCEL] Deployment triggered: id=${data.id} readyState=${data.readyState} url=${data.url}`
  );

  return {
    id: data.id,
    url: data.url,
    readyState: data.readyState,
  };
}

/**
 * Polls a Vercel deployment until it reaches a terminal state (READY, ERROR, CANCELED).
 *
 * @param {object} opts
 * @param {string} opts.deploymentId - Vercel deployment ID (e.g. "dpl_xxx")
 * @param {string} opts.vercelToken - Vercel API bearer token
 * @param {number} [opts.timeoutMs] - Max time to wait in ms (default: 300000 = 5 min)
 * @param {number} [opts.pollIntervalMs] - Poll interval in ms (default: 5000)
 * @returns {Promise<{url: string, readyState: string}>}
 */
export async function waitForDeployment({
  deploymentId,
  vercelToken,
  timeoutMs = 300000,
  pollIntervalMs = 5000,
}) {
  if (!vercelToken) throw new Error("VERCEL_TOKEN not configured");

  const teamParam = `?teamId=${VERCEL_TEAM_SLUG}`;
  const terminal = new Set(["READY", "ERROR", "CANCELED"]);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const resp = await fetch(
      `${VERCEL_API}/v13/deployments/${deploymentId}${teamParam}`,
      {
        headers: {
          Authorization: `Bearer ${vercelToken}`,
        },
      }
    );

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(
        `Vercel deployment status error (${resp.status}): ${data.error?.message || JSON.stringify(data)}`
      );
    }

    const { readyState, url } = data;
    console.log(`[VERCEL] Deployment ${deploymentId} state: ${readyState}`);

    if (terminal.has(readyState)) {
      return { url, readyState };
    }

    // Wait before polling again
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(
    `Vercel deployment ${deploymentId} timed out after ${timeoutMs / 1000}s`
  );
}

/**
 * Adds a custom domain to an existing Vercel project.
 * Uses POST /v10/projects/{projectId}/domains
 *
 * @param {object} opts
 * @param {string} opts.projectId - Vercel project ID
 * @param {string} opts.domain - Custom domain to add, e.g. "personal-crm-a7f3.dante.id"
 * @param {string} opts.vercelToken - Vercel API bearer token
 * @returns {Promise<void>}
 */
export async function addCustomDomain({ projectId, domain, vercelToken }) {
  if (!vercelToken) throw new Error("VERCEL_TOKEN not configured");

  const teamParam = `?teamId=${VERCEL_TEAM_SLUG}`;
  const resp = await fetch(`${VERCEL_API}/v10/projects/${projectId}/domains${teamParam}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: domain }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    // 409 or domain_conflict = already added — treat as success
    if (
      resp.status === 409 ||
      (data.error && ["domain_conflict", "domain_already_exists"].includes(data.error.code))
    ) {
      console.log(`[VERCEL] Custom domain ${domain} already on project ${projectId} — skipping`);
      return;
    }
    throw new Error(
      `Vercel domain API error (${resp.status}): ${data.error?.message || JSON.stringify(data)}`
    );
  }

  console.log(`[VERCEL] Custom domain added: ${domain} → project ${projectId}`);
}
