import { Router } from "express";

export const neoChatRouter = Router();

// Neo's OpenClaw gateway (in-cluster)
const NEO_GATEWAY = process.env.NEO_GATEWAY_URL || "http://neo-worker.agents.svc.cluster.local:18789";
const NEO_TOKEN = process.env.NEO_GATEWAY_TOKEN || "neo-worker-gw-tok-2026";

const SYSTEM_PROMPT = `You are Neo, an AI engineering assistant embedded in the tasks.dante.id dashboard.
The user is describing work they need done. Your job is to:
1. Understand what they need
2. Ask clarifying questions if the request is vague
3. When you have enough info, create a task on the task board

To create a task, use your tools (you have access to exec, web_fetch, etc).
Create tasks via the dashboard API:
  curl -s -X POST "https://tasks.dante.id/api/tasks" -H "Content-Type: application/json" -d '{"title":"...","description":"...","type":"coding|ops|research|design","priority":"low|normal|high|urgent"}'

Be conversational, helpful, and concise. You're talking to Dante or a team member.
If the user just wants to chat, that's fine too — you're a full agent.`;

// POST /api/neo-chat — streaming chat with Neo
neoChatRouter.post("/", async (req, res) => {
  try {
    const { messages, sessionId } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: "messages array required" });
    }

    // Build OpenAI-format messages with system prompt
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ];

    const userId = sessionId || `dashboard-${Date.now()}`;

    const response = await fetch(`${NEO_GATEWAY}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NEO_TOKEN}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": "main",
      },
      body: JSON.stringify({
        model: "openclaw:main",
        messages: fullMessages,
        stream: true,
        user: userId,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Neo gateway error:", response.status, err);
      return res.status(response.status).json({ error: `Gateway error: ${response.status}` });
    }

    // Stream SSE to client
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
    } catch (streamErr) {
      console.error("Stream error:", streamErr.message);
    }

    res.end();
  } catch (e) {
    console.error("Neo chat error:", e.message);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    }
  }
});

// Non-streaming fallback
neoChatRouter.post("/sync", async (req, res) => {
  try {
    const { messages, sessionId } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: "messages array required" });
    }

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ];

    const userId = sessionId || `dashboard-${Date.now()}`;

    const response = await fetch(`${NEO_GATEWAY}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NEO_TOKEN}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": "main",
      },
      body: JSON.stringify({
        model: "openclaw:main",
        messages: fullMessages,
        stream: false,
        user: userId,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
