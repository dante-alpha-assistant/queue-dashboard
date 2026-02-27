import { Router } from "express";
import crypto from "crypto";
import redis from "../redis.js";

export const router = Router();

const TASKS = "agent:tasks";
const RESULTS = "agent:results";
const DLQ = "agent:dlq";
const GROUP = "workers";

function parseStreamEntry([id, fields]) {
  const obj = { streamId: id };
  for (let i = 0; i < fields.length; i += 2) {
    const key = fields[i];
    const val = fields[i + 1];
    if (key === "payload") {
      try { obj[key] = JSON.parse(val); } catch { obj[key] = val; }
    } else {
      obj[key] = val;
    }
  }
  return obj;
}

async function safeXlen(stream) {
  try { return await redis.xlen(stream); } catch { return 0; }
}

async function safeXrange(stream, start = "-", end = "+") {
  try { return (await redis.xrange(stream, start, end)).map(parseStreamEntry); } catch { return []; }
}

router.get("/stats", async (_req, res) => {
  try {
    const [pending, completed, failed] = await Promise.all([
      safeXlen(TASKS), safeXlen(RESULTS), safeXlen(DLQ),
    ]);
    let processing = 0;
    try {
      const summary = await redis.xpending(TASKS, GROUP);
      if (summary && summary[0]) processing = Number(summary[0]);
    } catch {}
    res.json({ pending, processing, completed, failed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/tasks", async (_req, res) => {
  try {
    const tasks = await safeXrange(TASKS);
    res.json(tasks.map(t => ({ ...t, status: "pending" })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/processing", async (_req, res) => {
  try {
    const entries = await redis.xpending(TASKS, GROUP, "-", "+", "100").catch(() => []);
    const results = [];
    for (const [id, consumer, idleMs, deliveryCount] of entries) {
      const raw = await redis.xrange(TASKS, id, id);
      const data = raw.length ? parseStreamEntry(raw[0]) : { streamId: id };
      results.push({ ...data, status: "processing", consumer, idleMs: Number(idleMs), deliveryCount: Number(deliveryCount) });
    }
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/results", async (_req, res) => {
  try {
    const limit = parseInt(_req.query.limit) || 50;
    const raw = await redis.xrevrange(RESULTS, "+", "-", "COUNT", limit).catch(() => []);
    res.json(raw.map(parseStreamEntry));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/dlq", async (_req, res) => {
  try {
    res.json(await safeXrange(DLQ));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const fields = [];
    for (const [k, v] of Object.entries(req.body)) {
      fields.push(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    fields.push("id", id);
    const streamId = await redis.xadd(TASKS, "*", ...fields);
    res.json({ id, streamId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/dlq/:taskId/retry", async (req, res) => {
  try {
    const entries = await safeXrange(DLQ);
    const match = entries.find(e => e.id === req.params.taskId || e.taskId === req.params.taskId);
    if (!match) return res.status(404).json({ error: "Not found in DLQ" });
    const { streamId: dlqStreamId, ...data } = match;
    const fields = [];
    for (const [k, v] of Object.entries(data)) {
      fields.push(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    fields.push("retryCount", "0");
    const newStreamId = await redis.xadd(TASKS, "*", ...fields);
    await redis.xdel(DLQ, dlqStreamId);
    res.json({ id: match.id || match.taskId, streamId: newStreamId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/drain", async (req, res) => {
  if (req.query.confirm !== "true") return res.status(400).json({ error: "Pass ?confirm=true" });
  try {
    await Promise.all([
      redis.xtrim(TASKS, "MAXLEN", 0),
      redis.xtrim(RESULTS, "MAXLEN", 0),
      redis.xtrim(DLQ, "MAXLEN", 0),
    ]);
    res.json({ drained: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
