import { Router } from "express";

export const githubRouter = Router();

// In-memory cache: key -> { data, ts }
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

/** Called when a new app is created to invalidate repo cache */
export function invalidateGithubRepoCache() {
  cache.clear();
}

// GET /api/github/repos?q=searchterm
githubRouter.get("/repos", async (req, res) => {
  const token = process.env.GH_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "GH_TOKEN not configured" });
  }

  const q = (req.query.q || "").trim();
  const cacheKey = `repos:${q}`;

  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    let repos;

    if (q) {
      // Search repos matching query under dante-alpha-assistant org
      const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}+user:dante-alpha-assistant&per_page=20`;
      const resp = await fetch(searchUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "queue-dashboard",
        },
      });
      if (!resp.ok) {
        const body = await resp.text();
        return res.status(resp.status).json({ error: `GitHub API error: ${resp.status}`, detail: body });
      }
      const data = await resp.json();
      repos = data.items || [];
    } else {
      // Return most recently updated repos (limit 20)
      const listUrl = `https://api.github.com/users/dante-alpha-assistant/repos?sort=updated&per_page=20`;
      const resp = await fetch(listUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "queue-dashboard",
        },
      });
      if (!resp.ok) {
        const body = await resp.text();
        return res.status(resp.status).json({ error: `GitHub API error: ${resp.status}`, detail: body });
      }
      repos = await resp.json();
    }

    // Map to the required response format
    const result = repos.map((r) => ({
      full_name: r.full_name,
      name: r.name,
      description: r.description,
      language: r.language,
      updated_at: r.updated_at,
      default_branch: r.default_branch,
      html_url: r.html_url,
      private: r.private,
    }));

    setCache(cacheKey, result);
    res.json(result);
  } catch (e) {
    console.error("[GitHub] repo search error:", e.message);
    res.status(500).json({ error: e.message });
  }
});
