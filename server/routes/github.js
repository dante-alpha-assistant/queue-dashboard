import { Router } from "express";

export const githubRouter = Router();

// In-memory cache: key → { data, ts }
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

/** Call this to invalidate all cached GitHub repo results */
export function invalidateGithubRepoCache() {
  cache.clear();
}

function pick(repo) {
  return {
    full_name: repo.full_name,
    name: repo.name,
    description: repo.description,
    language: repo.language,
    updated_at: repo.updated_at,
    default_branch: repo.default_branch,
  };
}

// GET /api/github/repos?q=searchterm
githubRouter.get("/repos", async (req, res) => {
  try {
    const ghToken = process.env.GH_TOKEN;
    if (!ghToken) {
      return res.status(500).json({ error: "GH_TOKEN not configured" });
    }

    const q = (req.query.q || "").trim();
    const cacheKey = `repos:${q}`;

    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const headers = {
      Authorization: `token ${ghToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "queue-dashboard",
    };

    let repos;

    if (q) {
      // Search repos matching query under the org
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}+user:dante-alpha-assistant&per_page=20&sort=updated`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        const body = await resp.text();
        return res.status(resp.status).json({ error: `GitHub API error: ${resp.status}`, detail: body });
      }
      const json = await resp.json();
      repos = (json.items || []).map(pick);
    } else {
      // Return most recently updated repos
      const url = `https://api.github.com/users/dante-alpha-assistant/repos?sort=updated&per_page=20`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        const body = await resp.text();
        return res.status(resp.status).json({ error: `GitHub API error: ${resp.status}`, detail: body });
      }
      repos = (await resp.json()).map(pick);
    }

    setCache(cacheKey, repos);
    res.json(repos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
