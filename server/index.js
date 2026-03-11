import express from "express";
import { runMigrations } from "./migrate.js";
import supabase from "./supabase.js";
import cors from "cors";
import { router } from "./routes/tasks.js";
import { chatRouter } from "./routes/chat.js";
import { neoChatRouter } from "./routes/neo-chat.js";
import { agentsRouter } from "./routes/agents.js";
import { healthRouter } from "./routes/health.js";
import { skillsRouter } from "./routes/skills.js";
import { attachmentsRouter, ensureAttachmentsBucket } from "./routes/attachments.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use("/api", router);
app.use("/api/chat", chatRouter);
app.use("/api/neo-chat", neoChatRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/health", healthRouter);
app.use("/api/skills", skillsRouter);
app.use("/api", attachmentsRouter);

// Serve static frontend in production
import { serveStatic } from "./static.js";
serveStatic(app);

const PORT = process.env.PORT || 9092;

// Run pending database migrations on startup
ensureAttachmentsBucket().catch(e => console.error('[BOOT] Bucket init failed:', e.message));
runMigrations(supabase).then(r => {
  if (r.applied?.length) console.log('[BOOT] Migrations applied:', r.applied.join(', '));
  if (r.error) console.error('[BOOT] Migration error:', r.error);
}).catch(e => console.error('[BOOT] Migration runner failed:', e.message));
app.listen(PORT, () => console.log(`Queue dashboard API on :${PORT}`));
