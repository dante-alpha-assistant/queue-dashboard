import { Router } from "express";
import supabase from "../supabase.js";

export const appCredentialsRouter = Router({ mergeParams: true });

// GET /api/apps/:id/credentials/resolve — return credential metadata with k8s mapping (no secret values)
// NOTE: must be registered before /:credId to avoid "resolve" matching as a credId
appCredentialsRouter.get("/resolve", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("app_credentials")
      .select("credential_name, credential_type, k8s_secret_name, k8s_secret_key, description")
      .eq("app_id", req.params.id)
      .order("credential_name");
    if (error) throw error;

    const credentials = (data || []).map((c) => ({
      name: c.credential_name,
      type: c.credential_type,
      configured: !!(c.k8s_secret_name && c.k8s_secret_key),
      k8s_secret_name: c.k8s_secret_name,
      k8s_secret_key: c.k8s_secret_key,
      description: c.description,
    }));

    res.json({
      app_id: req.params.id,
      credentials,
      count: credentials.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/apps/:id/credentials — list all credentials for an app
appCredentialsRouter.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("app_credentials")
      .select("*")
      .eq("app_id", req.params.id)
      .order("credential_name");
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/apps/:id/credentials — add a credential
appCredentialsRouter.post("/", async (req, res) => {
  try {
    const {
      credential_name,
      credential_type = "secret",
      k8s_secret_name,
      k8s_secret_key,
      description,
    } = req.body;

    if (!credential_name || !credential_name.trim()) {
      return res.status(400).json({ error: "credential_name is required" });
    }

    const { data, error } = await supabase
      .from("app_credentials")
      .insert({
        app_id: req.params.id,
        credential_name: credential_name.trim(),
        credential_type,
        k8s_secret_name: k8s_secret_name || null,
        k8s_secret_key: k8s_secret_key || null,
        description: description || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "Credential with that name already exists for this app" });
    }
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/apps/:id/credentials/:credId — update a credential
appCredentialsRouter.patch("/:credId", async (req, res) => {
  try {
    const { credential_type, k8s_secret_name, k8s_secret_key, description } = req.body;
    const updates = { updated_at: new Date().toISOString() };

    if (credential_type !== undefined) updates.credential_type = credential_type;
    if (k8s_secret_name !== undefined) updates.k8s_secret_name = k8s_secret_name || null;
    if (k8s_secret_key !== undefined) updates.k8s_secret_key = k8s_secret_key || null;
    if (description !== undefined) updates.description = description || null;

    const { data, error } = await supabase
      .from("app_credentials")
      .update(updates)
      .eq("id", req.params.credId)
      .eq("app_id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Credential not found" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/apps/:id/credentials/:credId — remove a credential
appCredentialsRouter.delete("/:credId", async (req, res) => {
  try {
    const { error } = await supabase
      .from("app_credentials")
      .delete()
      .eq("id", req.params.credId)
      .eq("app_id", req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
