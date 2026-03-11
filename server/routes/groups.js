import { Router } from "express";
import supabase from "../supabase.js";

export const groupsRouter = Router();

// List all groups with member counts
groupsRouter.get("/", async (req, res) => {
  try {
    const { data: groups, error } = await supabase
      .from("crm_groups")
      .select("*")
      .order("name");
    if (error) throw error;

    // Get member counts per group
    const groupIds = (groups || []).map(g => g.id);
    let memberCounts = {};
    if (groupIds.length > 0) {
      const { data: counts, error: cErr } = await supabase
        .from("crm_group_members")
        .select("group_id");
      if (!cErr && counts) {
        for (const row of counts) {
          memberCounts[row.group_id] = (memberCounts[row.group_id] || 0) + 1;
        }
      }
    }

    const result = (groups || []).map(g => ({
      ...g,
      member_count: memberCounts[g.id] || 0,
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get single group with members
groupsRouter.get("/:id", async (req, res) => {
  try {
    const { data: group, error } = await supabase
      .from("crm_groups")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (error) return res.status(404).json({ error: "Group not found" });

    // Get members with contact details
    const { data: members, error: mErr } = await supabase
      .from("crm_group_members")
      .select("id, contact_id, added_at")
      .eq("group_id", req.params.id)
      .order("added_at", { ascending: false });

    let contacts = [];
    if (!mErr && members && members.length > 0) {
      const contactIds = members.map(m => m.contact_id);
      const { data: contactData } = await supabase
        .from("crm_contacts")
        .select("id, name, email, phone, company, role, tags, avatar_url")
        .in("id", contactIds);
      
      const contactMap = Object.fromEntries((contactData || []).map(c => [c.id, c]));
      contacts = members.map(m => ({
        membership_id: m.id,
        added_at: m.added_at,
        ...(contactMap[m.contact_id] || { id: m.contact_id, name: "Unknown" }),
      }));
    }

    res.json({ ...group, members: contacts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create group
groupsRouter.post("/", async (req, res) => {
  try {
    const { name, color, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const { data, error } = await supabase
      .from("crm_groups")
      .insert({
        name: name.trim(),
        color: color || "#6366f1",
        description: description?.trim() || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update group
groupsRouter.patch("/:id", async (req, res) => {
  try {
    const { name, color, description } = req.body;
    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ error: "Name cannot be empty" });
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (color !== undefined) updates.color = color;
    if (description !== undefined) updates.description = description?.trim() || null;

    const { data, error } = await supabase
      .from("crm_groups")
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

// Delete group
groupsRouter.delete("/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("crm_groups")
      .delete()
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add members to group (bulk)
groupsRouter.post("/:id/members", async (req, res) => {
  try {
    const { contact_ids } = req.body;
    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return res.status(400).json({ error: "contact_ids array is required" });
    }

    const inserts = contact_ids.map(cid => ({
      group_id: req.params.id,
      contact_id: cid,
    }));

    // Use upsert to ignore duplicates
    const { data, error } = await supabase
      .from("crm_group_members")
      .upsert(inserts, { onConflict: "group_id,contact_id", ignoreDuplicates: true })
      .select();
    if (error) throw error;
    res.json({ ok: true, added: data?.length || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove member from group
groupsRouter.delete("/:id/members/:contactId", async (req, res) => {
  try {
    const { error } = await supabase
      .from("crm_group_members")
      .delete()
      .eq("group_id", req.params.id)
      .eq("contact_id", req.params.contactId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Bulk remove members from group
groupsRouter.post("/:id/members/remove", async (req, res) => {
  try {
    const { contact_ids } = req.body;
    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return res.status(400).json({ error: "contact_ids array is required" });
    }

    const { error } = await supabase
      .from("crm_group_members")
      .delete()
      .eq("group_id", req.params.id)
      .in("contact_id", contact_ids);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
