import { Router } from "express";
import crypto from "crypto";

export const githubRouter = Router();

// In-memory cache: key -> { data, ts }
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory OAuth state store (prevents CSRF)
const oauthStates = new Map();
const OAUTH_STATE_TTL = 10 * 60 * 1000; // 10 minutes

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

// GET /api/github/auth?redirect_uri=...
// Returns the GitHub OAuth authorization URL for the user to redirect to
githubRouter.get("/auth", (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(501).json({ error: "GitHub OAuth not configured (GITHUB_CLIENT_ID missing)" });
  }

  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, { ts: Date.now(), redirectUri: req.query.redirect_uri || "" });

  // Clean up old states
  for (const [k, v] of oauthStates) {
    if (Date.now() - v.ts > OAUTH_STATE_TTL) oauthStates.delete(k);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "repo",
    state,
  });
  if (req.query.redirect_uri) params.set("redirect_uri", req.query.redirect_uri);

  const url = `https://github.com/login/oauth/authorize?${params}`;
  res.json({ url, state });
});

// GET /api/github/callback?code=XXX&state=XXX
// Exchanges the OAuth code for an access token
githubRouter.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(501).json({ error: "GitHub OAuth not configured" });
  }
  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }
  // Validate state (CSRF protection)
  if (!state || !oauthStates.has(state)) {
    return res.status(400).json({ error: "Invalid or expired OAuth state" });
  }
  oauthStates.delete(state);

  try {
    const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "queue-dashboard",
      },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    const tokenData = await tokenResp.json();
    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description || tokenData.error });
    }

    const accessToken = tokenData.access_token;

    // Fetch user info
    const userResp = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "queue-dashboard",
      },
    });
    const user = await userResp.json();

    res.json({ token: accessToken, login: user.login, avatar_url: user.avatar_url });
  } catch (e) {
    console.error("[GitHub OAuth] callback error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/github/user-repos?token=XXX&q=YYY
// Returns repos for the authenticated user (using the OAuth token)
githubRouter.get("/user-repos", async (req, res) => {
  const { token, q = "" } = req.query;
  if (!token) return res.status(401).json({ error: "Missing token" });

  const cacheKey = `user-repos:${token}:${q}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    let repos;
    if (q.trim()) {
      // Search user repos
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}+user:@me&per_page=30`;
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "queue-dashboard",
        },
      });
      if (!resp.ok) return res.status(resp.status).json({ error: `GitHub API error: ${resp.status}` });
      const data = await resp.json();
      repos = data.items || [];
    } else {
      const url = `https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner`;
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "queue-dashboard",
        },
      });
      if (!resp.ok) return res.status(resp.status).json({ error: `GitHub API error: ${resp.status}` });
      repos = await resp.json();
    }

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
    console.error("[GitHub] user-repos error:", e.message);
    res.status(500).json({ error: e.message });
  }
});
