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
