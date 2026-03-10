import { Router } from "express";
import supabase from "../supabase.js";

export const attachmentsRouter = Router();

const BUCKET = "task-attachments";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

// Ensure bucket exists (called once at startup)
export async function ensureAttachmentsBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
    });
    if (error) {
      console.error("[ATTACHMENTS] Failed to create bucket:", error.message);
    } else {
      console.log("[ATTACHMENTS] Created storage bucket:", BUCKET);
    }
  }
}

// POST /api/tasks/:taskId/attachments — upload an image
attachmentsRouter.post("/tasks/:taskId/attachments", async (req, res) => {
  const { taskId } = req.params;

  // Expect JSON body with base64 image data
  const { data: base64Data, filename, type } = req.body;
  if (!base64Data || !filename) {
    return res.status(400).json({ error: "Missing data or filename" });
  }

  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({ error: `Unsupported file type: ${type}. Allowed: ${ALLOWED_TYPES.join(", ")}` });
  }

  // Strip data URL prefix if present
  const raw = base64Data.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");

  if (buffer.length > MAX_SIZE) {
    return res.status(400).json({ error: `File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Max: 10MB` });
  }

  const storagePath = `${taskId}/${Date.now()}-${filename}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[ATTACHMENTS] Upload error:", uploadError.message);
      return res.status(500).json({ error: uploadError.message });
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl;

    // Add to task metadata.attachments array
    const { data: task, error: fetchError } = await supabase
      .from("agent_tasks")
      .select("metadata")
      .eq("id", taskId)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: "Task not found" });
    }

    const metadata = task.metadata || {};
    const attachments = metadata.attachments || [];
    const attachment = {
      url: publicUrl,
      filename,
      type,
      storage_path: storagePath,
      uploaded_at: new Date().toISOString(),
    };
    attachments.push(attachment);

    const { error: updateError } = await supabase
      .from("agent_tasks")
      .update({ metadata: { ...metadata, attachments } })
      .eq("id", taskId);

    if (updateError) {
      console.error("[ATTACHMENTS] Update error:", updateError.message);
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ attachment, total: attachments.length });
  } catch (e) {
    console.error("[ATTACHMENTS] Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/tasks/:taskId/attachments — list attachments
attachmentsRouter.get("/tasks/:taskId/attachments", async (req, res) => {
  const { taskId } = req.params;

  try {
    const { data: task, error } = await supabase
      .from("agent_tasks")
      .select("metadata")
      .eq("id", taskId)
      .single();

    if (error) {
      return res.status(404).json({ error: "Task not found" });
    }

    const attachments = task.metadata?.attachments || [];
    res.json(attachments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/tasks/:taskId/attachments/:index — remove an attachment
attachmentsRouter.delete("/tasks/:taskId/attachments/:index", async (req, res) => {
  const { taskId, index } = req.params;
  const idx = parseInt(index);

  try {
    const { data: task, error: fetchError } = await supabase
      .from("agent_tasks")
      .select("metadata")
      .eq("id", taskId)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: "Task not found" });
    }

    const metadata = task.metadata || {};
    const attachments = metadata.attachments || [];

    if (idx < 0 || idx >= attachments.length) {
      return res.status(400).json({ error: "Invalid attachment index" });
    }

    const removed = attachments[idx];

    // Delete from storage
    if (removed.storage_path) {
      await supabase.storage.from(BUCKET).remove([removed.storage_path]);
    }

    attachments.splice(idx, 1);

    await supabase
      .from("agent_tasks")
      .update({ metadata: { ...metadata, attachments } })
      .eq("id", taskId);

    res.json({ removed, remaining: attachments.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
