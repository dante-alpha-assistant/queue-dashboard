import { Router } from "express";
import supabase from "../supabase.js";

export const contactsRouter = Router();

// Ensure avatar bucket exists on import
async function ensureAvatarBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === "contact-avatars");
    if (!exists) {
      await supabase.storage.createBucket("contact-avatars", {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      });
      console.log("[CRM] Created contact-avatars bucket");
    }
  } catch (e) {
    console.error("[CRM] Failed to create avatar bucket:", e.message);
  }
}
ensureAvatarBucket();

// Get distinct companies (for autocomplete) — must be before /:id
contactsRouter.get("/meta/companies", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("crm_contacts")
      .select("company")
      .not("company", "is", null)
      .order("company");
    if (error) throw error;
    const unique = [...new Set((data || []).map(d => d.company).filter(Boolean))];
    res.json(unique);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get distinct tags (for autocomplete) — must be before /:id
contactsRouter.get("/meta/tags", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("crm_contacts")
      .select("tags");
    if (error) throw error;
    const allTags = (data || []).flatMap(d => d.tags || []);
    const unique = [...new Set(allTags)].sort();
    res.json(unique);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List contacts (with optional search)
contactsRouter.get("/", async (req, res) => {
  try {
    const { search, company, tag, limit: limitParam, offset: offsetParam } = req.query;
    const limit = Math.min(parseInt(limitParam) || 50, 200);
    const offset = parseInt(offsetParam) || 0;

    let query = supabase
      .from("crm_contacts")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
    }
    if (company) {
      query = query.ilike("company", `%${company}%`);
    }
    if (tag) {
      query = query.contains("tags", [tag]);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data: data || [], total: count || 0, limit, offset });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get single contact
contactsRouter.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("crm_contacts")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (error) return res.status(404).json({ error: "Contact not found" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create contact
contactsRouter.post("/", async (req, res) => {
  try {
    const { name, email, phone, company, role, tags, notes, source } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const { data, error } = await supabase
      .from("crm_contacts")
      .insert({
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        role: role?.trim() || null,
        tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
        notes: notes || null,
        source: source?.trim() || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update contact
contactsRouter.patch("/:id", async (req, res) => {
  try {
    const { name, email, phone, company, role, tags, notes, source } = req.body;
    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ error: "Name cannot be empty" });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email?.trim() || null;
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (company !== undefined) updates.company = company?.trim() || null;
    if (role !== undefined) updates.role = role?.trim() || null;
    if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : (tags ? [tags] : []);
    if (notes !== undefined) updates.notes = notes || null;
    if (source !== undefined) updates.source = source?.trim() || null;

    const { data, error } = await supabase
      .from("crm_contacts")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete contact
contactsRouter.delete("/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("crm_contacts")
      .delete()
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload avatar
contactsRouter.post("/:id/avatar", async (req, res) => {
  try {
    const contactId = req.params.id;

    // Expect base64 body: { data: "base64string", mimeType: "image/png" }
    const { data: b64Data, mimeType } = req.body;
    if (!b64Data) return res.status(400).json({ error: "data (base64) is required" });

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const type = mimeType || "image/png";
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid mime type. Allowed: ${allowedTypes.join(", ")}` });
    }

    const ext = type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1];
    const filePath = `${contactId}/avatar.${ext}`;

    // Decode base64
    const buffer = Buffer.from(b64Data, "base64");

    // Upload to Supabase storage
    const { error: uploadErr } = await supabase.storage
      .from("contact-avatars")
      .upload(filePath, buffer, {
        contentType: type,
        upsert: true,
      });
    if (uploadErr) throw uploadErr;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("contact-avatars")
      .getPublicUrl(filePath);

    const avatarUrl = urlData.publicUrl;

    // Update contact with avatar URL
    const { data: contact, error: updateErr } = await supabase
      .from("crm_contacts")
      .update({ avatar_url: avatarUrl })
      .eq("id", contactId)
      .select()
      .single();
    if (updateErr) throw updateErr;

    res.json({ ok: true, avatar_url: avatarUrl, contact });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


