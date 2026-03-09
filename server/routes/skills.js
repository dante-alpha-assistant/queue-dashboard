import { Router } from "express";
import supabase from "../supabase.js";

export const skillsRouter = Router();

// Cache skill metadata for 5 minutes
let skillsCache = null;
let skillsCacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * GET /api/skills
 * Returns: { skills: [...], agents: [...] }
 * - skills: array of { name, description } from GitHub agent-skills repo
 * - agents: array of { id, name, skills } from agent_cards
 */
skillsRouter.get("/", async (_req, res) => {
  try {
    // Always get fresh agent data
    const { data: agents, error: agentErr } = await supabase
      .from("agent_cards")
      .select("id, name, skills, status, avatar, emoji, capabilities")
      .order("name");
    if (agentErr) throw agentErr;

    // Fetch skill metadata from GitHub (cached)
    let skillsMeta = [];
    if (skillsCache && Date.now() - skillsCacheAt < CACHE_TTL) {
      skillsMeta = skillsCache;
    } else {
      try {
        skillsMeta = await fetchSkillsFromGitHub();
        skillsCache = skillsMeta;
        skillsCacheAt = Date.now();
      } catch (e) {
        console.error("[skills] GitHub fetch failed:", e.message);
        // Fall back to just skill names from agents
        const allNames = new Set();
        (agents || []).forEach(a => (a.skills || []).forEach(s => allNames.add(s)));
        skillsMeta = [...allNames].map(name => ({ name, description: null }));
      }
    }

    res.json({ skills: skillsMeta, agents: agents || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function fetchSkillsFromGitHub() {
  const owner = "dante-alpha-assistant";
  const repo = "agent-skills";
  const token = process.env.GH_TOKEN;
  const headers = {
    Accept: "application/vnd.github.v3+json",
    ...(token ? { Authorization: `token ${token}` } : {}),
  };

  // List skill directories
  const dirRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/skills`, { headers });
  if (!dirRes.ok) throw new Error(`GitHub API ${dirRes.status}`);
  const dirs = await dirRes.json();

  const skills = [];
  for (const dir of dirs) {
    if (dir.type !== "dir") continue;
    const name = dir.name;
    let description = null;

    // Try to read first few lines of SKILL.md for description
    try {
      const mdRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/skills/${name}/SKILL.md`,
        { headers }
      );
      if (mdRes.ok) {
        const mdData = await mdRes.json();
        const content = Buffer.from(mdData.content, "base64").toString("utf8");
        // Extract description: first non-heading, non-empty line
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("---") || trimmed.startsWith("```")) continue;
          description = trimmed.slice(0, 200);
          break;
        }
      }
    } catch { /* ignore */ }

    skills.push({
      name,
      description,
      github_url: `https://github.com/${owner}/${repo}/tree/main/skills/${name}`,
    });
  }

  return skills;
}
