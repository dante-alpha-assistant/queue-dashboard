import { Router } from "express";
import redis from "../redis.js";

export const chatRouter = Router();
const CHAT_STREAM = "agent:chat";

chatRouter.post("/", async (req, res) => {
  try {
    const { text, sender = "user", name = "Dante" } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "text required" });
    const id = await redis.xadd(CHAT_STREAM, "*",
      "sender", sender, "name", name,
      "text", text.trim(), "timestamp", new Date().toISOString()
    );
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

chatRouter.get("/", async (req, res) => {
  try {
    const after = req.query.after || "-";
    const limit = parseInt(req.query.limit) || 50;
    const raw = after === "-"
      ? await redis.xrevrange(CHAT_STREAM, "+", "-", "COUNT", limit)
      : await redis.xrange(CHAT_STREAM, `(${after}`, "+", "COUNT", limit);
    const messages = (after === "-" ? raw.reverse() : raw).map(([id, fields]) => {
      const obj = { id };
      for (let i = 0; i < fields.length; i += 2) obj[fields[i]] = fields[i + 1];
      return obj;
    });
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
