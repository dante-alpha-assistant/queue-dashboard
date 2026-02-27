import { Router } from "express";

export const chatRouter = Router();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "1476656995221111027"; // #dante-agents
const NEO_BOT_ID = "1471821951663214737";
const BASE = "https://discord.com/api/v10";

const headers = {
  Authorization: `Bot ${DISCORD_TOKEN}`,
  "Content-Type": "application/json",
};

// Send a message to Discord channel, tagging Neo
chatRouter.post("/", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "text required" });

    const content = `**[Dante via Dashboard]** <@${NEO_BOT_ID}> ${text.trim()}`;
    const resp = await fetch(`${BASE}/channels/${CHANNEL_ID}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(resp.status).json({ error: err });
    }

    const msg = await resp.json();
    res.json({ ok: true, id: msg.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get recent messages from Discord channel
chatRouter.get("/", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const after = req.query.after || "";
    const url = after
      ? `${BASE}/channels/${CHANNEL_ID}/messages?limit=${limit}&after=${after}&sort=desc`
      : `${BASE}/channels/${CHANNEL_ID}/messages?limit=${limit}`;

    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      const err = await resp.text();
      return res.status(resp.status).json({ error: err });
    }

    const raw = await resp.json();
    // Discord returns newest first, reverse for chronological
    const messages = raw.reverse().map((msg) => {
      const isDashboardMsg = msg.content.startsWith("**[Dante via Dashboard]**");
      return {
      id: msg.id,
      sender: isDashboardMsg ? "user" : (msg.author.bot ? "agent" : "user"),
      name: isDashboardMsg ? "Dante" : (msg.author.global_name || msg.author.username),
      text: isDashboardMsg ? msg.content.replace(/^\*\*\[Dante via Dashboard\]\*\*\s*/, "").replace(/<@!?\d+>\s*/g, "") : msg.content,
      timestamp: msg.timestamp,
      avatar: msg.author.avatar
        ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png?size=32`
        : null,
      botId: msg.author.id,
    }});

    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
