import { Router } from "express";
import supabase from "../supabase.js";

export const neoChatRouter = Router();

// Neo's OpenClaw gateway (in-cluster)
const NEO_GATEWAY = process.env.NEO_GATEWAY_URL || "http://neo-chat-worker.agents.svc.cluster.local:18789";
const NEO_TOKEN = process.env.NEO_GATEWAY_TOKEN || "neo-chat-worker-gw-tok-2026";

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

// ─── Conversation CRUD ───

// List conversations
neoChatRouter.get("/conversations", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create conversation
neoChatRouter.post("/conversations", async (req, res) => {
  try {
    const { title } = req.body || {};
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ title: title || null })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get messages for a conversation
neoChatRouter.get("/conversations/:id/messages", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", req.params.id)
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Send message in a conversation (streaming)
neoChatRouter.post("/conversations/:id/messages", async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { content, images } = req.body;
    if (!content && (!images || !images.length)) {
      return res.status(400).json({ error: "content required" });
    }

    // Save user message
    const { error: userMsgErr } = await supabase
      .from("chat_messages")
      .insert({ conversation_id: conversationId, role: "user", content: content || "" });
    if (userMsgErr) console.error("Failed to save user message:", userMsgErr.message);

    // Update conversation title from first message if untitled
    const { data: convo } = await supabase
      .from("chat_conversations")
      .select("title")
      .eq("id", conversationId)
      .single();
    if (convo && !convo.title && content) {
      await supabase
        .from("chat_conversations")
        .update({ title: content.slice(0, 60), updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    } else {
      await supabase
        .from("chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    // Get conversation history for context
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    // Build messages for gateway
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history || []).map(m => ({ role: m.role, content: m.content })),
    ];

    // Add images to last message if present
    if (images && images.length && fullMessages.length > 1) {
      const last = fullMessages[fullMessages.length - 1];
      const parts = [];
      if (last.content) parts.push({ type: "text", text: last.content });
      for (const img of images) {
        parts.push({ type: "image_url", image_url: { url: img } });
      }
      fullMessages[fullMessages.length - 1] = { role: last.role, content: parts };
    }

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
        user: `conversation-${conversationId}`,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Neo gateway error:", response.status, err);
      return res.status(response.status).json({ error: `Gateway error: ${response.status}` });
    }

    // Stream SSE to client and accumulate response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);

        // Parse chunks to accumulate response text
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) accumulated += delta;
          } catch {}
        }
      }
    } catch (streamErr) {
      console.error("Stream error:", streamErr.message);
    }

    // Save assistant message
    if (accumulated) {
      const { error: assistMsgErr } = await supabase
        .from("chat_messages")
        .insert({ conversation_id: conversationId, role: "assistant", content: accumulated });
      if (assistMsgErr) console.error("Failed to save assistant message:", assistMsgErr.message);
    }

    res.end();
  } catch (e) {
    console.error("Neo chat error:", e.message);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    }
  }
});

// Archive conversation (soft delete)
neoChatRouter.delete("/conversations/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("chat_conversations")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Legacy endpoints (backward compat) ───

// POST /api/neo-chat — streaming chat with Neo (no persistence)
neoChatRouter.post("/", async (req, res) => {
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
        stream: true,
        user: userId,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Neo gateway error:", response.status, err);
      return res.status(response.status).json({ error: `Gateway error: ${response.status}` });
    }

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
