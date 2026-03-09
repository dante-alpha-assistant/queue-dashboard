import { Router } from "express";
import supabase from "../supabase.js";

export const neoChatRouter = Router();

// Neo's OpenClaw gateway (in-cluster)
const NEO_GATEWAY = process.env.NEO_GATEWAY_URL || "http://neo.agents.svc.cluster.local:18789";
const NEO_TOKEN = process.env.NEO_GATEWAY_TOKEN || "neo-gw-tok-2026";

const SYSTEM_PROMPT = `You are Neo, an AI engineering assistant embedded in the tasks.dante.id dashboard.
The user is describing work they need done. Your job is to:
1. Understand what they need
2. Ask clarifying questions if the request is vague
3. When you have enough info, create a task using the create_task function

Be conversational, helpful, and concise. You're talking to Dante or a team member.
If the user just wants to chat, that's fine too — you're a full agent.`;

const CHAT_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task on the task board. Use this when the user wants to create a task.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short, descriptive task title" },
          description: { type: "string", description: "Detailed task description with context, requirements, and acceptance criteria (markdown supported)" },
          type: { type: "string", enum: ["coding", "ops", "general", "review", "research", "qa"], description: "Task type" },
          priority: { type: "string", enum: ["low", "normal", "high", "urgent"], description: "Task priority, default normal" },
        },
        required: ["title"],
      },
    },
  },
];

// Execute a tool call locally and return the result
async function executeToolCall(name, args) {
  if (name === "create_task") {
    try {
      const { data, error } = await supabase
        .from("agent_tasks")
        .insert({
          title: args.title,
          description: args.description || null,
          type: args.type || "general",
          priority: args.priority || "normal",
          dispatched_by: "neo-chat",
          status: "todo",
        })
        .select()
        .single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({
        success: true,
        task_id: data.id,
        title: data.title,
        url: `https://tasks.dante.id/?task=${data.id}`,
      });
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

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
    const convoId = req.params.id;
    // Query by conversation_id, falling back to project_id for legacy messages
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .or(`conversation_id.eq.${convoId},and(conversation_id.is.null,project_id.eq.${convoId})`)
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

    // Save user message (with images in metadata if present)
    const userMsgData = {
      conversation_id: conversationId,
      role: "user",
      content: content || "",
      metadata: images?.length ? { images } : {},
    };
    const { error: userMsgErr } = await supabase
      .from("chat_messages")
      .insert(userMsgData);
    if (userMsgErr) {
      console.error("Failed to save user message:", userMsgErr.message, userMsgErr.details);
    }

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

    // Helper to call Neo gateway
    async function callNeo(msgs, stream = true) {
      return fetch(`${NEO_GATEWAY}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NEO_TOKEN}`,
          "Content-Type": "application/json",
          "x-openclaw-agent-id": "main",
        },
        body: JSON.stringify({
          model: "openclaw:main",
          messages: msgs,
          tools: CHAT_TOOLS,
          stream,
          user: `conversation-${conversationId}`,
        }),
      });
    }

    const response = await callNeo(fullMessages);

    if (!response.ok) {
      const err = await response.text();
      console.error("Neo gateway error:", response.status, err);
      const friendlyErrors = {
        405: "Neo's chat endpoint is not enabled. The gateway needs chatCompletions enabled in its config.",
        401: "Authentication failed with Neo's gateway. Check NEO_GATEWAY_TOKEN.",
        403: "Access denied by Neo's gateway.",
        429: "Neo is rate-limited. Please try again in a moment.",
        502: "Neo's gateway is unreachable. The service may be restarting.",
        503: "Neo is temporarily unavailable. Please try again shortly.",
      };
      const message = friendlyErrors[response.status] || `Neo is unavailable (error ${response.status}). Please try again later.`;
      return res.status(502).json({ error: message });
    }

    // Stream SSE to client and accumulate response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Read the stream, detect tool_calls, handle them server-side
    async function readStream(resp) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let toolCalls = {}; // index -> { id, name, arguments }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (!delta) continue;

              // Accumulate text content and forward to client
              if (delta.content) {
                accumulated += delta.content;
                res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: delta.content } }] })}\n\n`);
              }

              // Accumulate tool calls (don't forward to client)
              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!toolCalls[idx]) toolCalls[idx] = { id: "", name: "", arguments: "" };
                  if (tc.id) toolCalls[idx].id = tc.id;
                  if (tc.function?.name) toolCalls[idx].name = tc.function.name;
                  if (tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments;
                }
              }
            } catch {}
          }
        }
      } catch (streamErr) {
        console.error("Stream error:", streamErr.message);
      }

      return { accumulated, toolCalls };
    }

    let { accumulated, toolCalls } = await readStream(response);

    // If tool calls were made, execute them and get Neo's follow-up response
    const toolCallList = Object.values(toolCalls).filter(tc => tc.name);
    if (toolCallList.length > 0) {
      // Send a "creating task..." indicator to the client
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "\n\n⏳ Creating task..." } }] })}\n\n`);

      // Build the tool call messages for the follow-up
      const assistantMsg = {
        role: "assistant",
        content: accumulated || null,
        tool_calls: toolCallList.map((tc, i) => ({
          id: tc.id || `call_${i}`,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };

      const toolResultMsgs = [];
      for (const tc of toolCallList) {
        let args = {};
        try { args = JSON.parse(tc.arguments); } catch {}
        const result = await executeToolCall(tc.name, args);
        toolResultMsgs.push({
          role: "tool",
          tool_call_id: tc.id || `call_0`,
          content: result,
        });
      }

      // Call Neo again with tool results to get the final response
      const followUpMsgs = [...fullMessages, assistantMsg, ...toolResultMsgs];
      const followUpResp = await callNeo(followUpMsgs);

      if (followUpResp.ok) {
        // Clear the "creating task..." indicator by sending a replacement
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "\r" } }] })}\n\n`);
        const followUp = await readStream(followUpResp);
        accumulated = (accumulated || "") + "\n\n" + followUp.accumulated;
      }
    }

    // Send done signal
    res.write("data: [DONE]\n\n");

    // Save assistant message
    if (accumulated) {
      // Clean up any control characters from tool call flow
      const cleanContent = accumulated.replace(/\n\n⏳ Creating task\.\.\.\r/g, "").trim();
      const { error: assistMsgErr } = await supabase
        .from("chat_messages")
        .insert({ conversation_id: conversationId, role: "assistant", content: cleanContent });
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
      const friendlyErrors = {
        405: "Neo's chat endpoint is not enabled. The gateway needs chatCompletions enabled in its config.",
        401: "Authentication failed with Neo's gateway.",
        403: "Access denied by Neo's gateway.",
        429: "Neo is rate-limited. Please try again in a moment.",
        502: "Neo's gateway is unreachable.",
        503: "Neo is temporarily unavailable.",
      };
      const message = friendlyErrors[response.status] || `Neo is unavailable (error ${response.status}).`;
      return res.status(502).json({ error: message });
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
