import { Router } from "express";
import supabase from "../supabase.js";

export const importRouter = Router();

// ── CSV helpers ──────────────────────────────────────────────────────────

/** Minimal RFC-4180 CSV parser (handles quoted fields, newlines inside quotes) */
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const row = [];
    while (i < len) {
      let value = "";
      // Skip leading whitespace (not newlines)
      while (i < len && text[i] === " ") i++;

      if (i < len && text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') {
              value += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            value += text[i++];
          }
        }
        // Skip until comma or end of line
        while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") i++;
      } else {
        // Unquoted field
        while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
          value += text[i++];
        }
        value = value.trimEnd();
      }

      row.push(value);

      if (i < len && text[i] === ",") {
        i++; // skip comma, continue row
      } else {
        break; // end of row
      }
    }

    // Skip line ending
    if (i < len && text[i] === "\r") i++;
    if (i < len && text[i] === "\n") i++;

    // Skip completely empty rows
    if (row.length === 1 && row[0] === "") continue;
    rows.push(row);
  }

  return rows;
}

/** Known CRM contact fields */
const CONTACT_FIELDS = ["name", "email", "phone", "company", "role", "tags", "notes", "source"];

/** Auto-detect column mapping from header names */
function autoMapColumns(headers) {
  const mapping = {};
  const aliases = {
    name: ["name", "full name", "fullname", "contact name", "display name", "nombre"],
    email: ["email", "e-mail", "email address", "mail", "correo"],
    phone: ["phone", "telephone", "tel", "mobile", "cell", "phone number", "telefono"],
    company: ["company", "organization", "org", "empresa", "organisation"],
    role: ["role", "title", "job title", "position", "cargo"],
    tags: ["tags", "labels", "categories", "groups", "etiquetas"],
    notes: ["notes", "note", "description", "comments", "notas"],
    source: ["source", "origin", "lead source", "fuente"],
  };

  headers.forEach((header, idx) => {
    const h = header.toLowerCase().trim();
    for (const [field, names] of Object.entries(aliases)) {
      if (names.includes(h) && !mapping[field]) {
        mapping[field] = idx;
        break;
      }
    }
  });

  return mapping;
}

// ── vCard parser ─────────────────────────────────────────────────────────

function parseVCards(text) {
  const contacts = [];
  // Unfold continuation lines (RFC 2425 §5.8.1)
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const cards = unfolded.split(/(?=BEGIN:VCARD)/i).filter(c => /BEGIN:VCARD/i.test(c));

  for (const card of cards) {
    const lines = card.split(/\r?\n/).filter(Boolean);
    const contact = { name: "", email: null, phone: null, company: null, role: null, tags: [], notes: null, source: "vcard" };

    for (const line of lines) {
      // Parse property;params:value
      const colonIdx = line.indexOf(":");
      if (colonIdx < 0) continue;
      const propPart = line.substring(0, colonIdx);
      const value = line.substring(colonIdx + 1).trim();
      const propName = propPart.split(";")[0].toUpperCase();

      switch (propName) {
        case "FN":
          contact.name = value;
          break;
        case "N": {
          // N:Last;First;Middle;Prefix;Suffix
          if (!contact.name) {
            const parts = value.split(";");
            contact.name = [parts[3], parts[1], parts[2], parts[0], parts[4]]
              .filter(Boolean)
              .join(" ")
              .trim();
          }
          break;
        }
        case "EMAIL":
          if (!contact.email) contact.email = value;
          break;
        case "TEL":
          if (!contact.phone) contact.phone = value;
          break;
        case "ORG":
          contact.company = value.split(";")[0];
          break;
        case "TITLE":
          contact.role = value;
          break;
        case "NOTE":
          contact.notes = value;
          break;
        case "CATEGORIES":
          contact.tags = value.split(",").map(t => t.trim()).filter(Boolean);
          break;
      }
    }

    if (contact.name) contacts.push(contact);
  }

  return contacts;
}

// ── Duplicate detection ──────────────────────────────────────────────────

async function findDuplicates(contacts) {
  // Get all emails from incoming contacts
  const emails = contacts
    .map(c => c.email?.toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) return {};

  const { data: existing } = await supabase
    .from("crm_contacts")
    .select("id, name, email")
    .in("email", emails);

  const emailMap = {};
  for (const e of existing || []) {
    if (e.email) emailMap[e.email.toLowerCase()] = e;
  }

  return emailMap;
}

// ── POST /api/import/csv — Parse CSV, return preview ─────────────────────

importRouter.post("/csv", async (req, res) => {
  try {
    const { data: csvData, filename } = req.body;
    if (!csvData) return res.status(400).json({ error: "data (CSV content) is required" });

    const rows = parseCSV(csvData);
    if (rows.length < 2) return res.status(400).json({ error: "CSV must have a header row and at least one data row" });

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const mapping = autoMapColumns(headers);

    // Build preview contacts from first 100 rows
    const previewLimit = Math.min(dataRows.length, 100);
    const preview = [];
    for (let i = 0; i < previewLimit; i++) {
      const row = dataRows[i];
      const contact = {};
      for (const [field, colIdx] of Object.entries(mapping)) {
        if (colIdx !== undefined && colIdx < row.length) {
          let val = row[colIdx]?.trim() || null;
          if (field === "tags" && val) {
            val = val.split(/[,;|]/).map(t => t.trim()).filter(Boolean);
          }
          contact[field] = val;
        }
      }
      if (contact.name) preview.push(contact);
    }

    // Check duplicates
    const dupeMap = await findDuplicates(preview);
    const previewWithDupes = preview.map(c => ({
      ...c,
      duplicate: c.email ? dupeMap[c.email.toLowerCase()] || null : null,
    }));

    const dupeCount = previewWithDupes.filter(c => c.duplicate).length;

    res.json({
      headers,
      mapping,
      totalRows: dataRows.length,
      preview: previewWithDupes,
      duplicates: dupeCount,
      filename: filename || "upload.csv",
      availableFields: CONTACT_FIELDS,
    });
  } catch (e) {
    console.error("[Import] CSV parse error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/import/csv/confirm — Actually import the CSV ───────────────

importRouter.post("/csv/confirm", async (req, res) => {
  try {
    const { data: csvData, mapping, filename, skipDuplicates = true } = req.body;
    if (!csvData || !mapping) return res.status(400).json({ error: "data and mapping are required" });

    const rows = parseCSV(csvData);
    if (rows.length < 2) return res.status(400).json({ error: "No data rows" });

    const dataRows = rows.slice(1);

    // Build contacts
    const contacts = [];
    for (const row of dataRows) {
      const contact = {};
      for (const [field, colIdx] of Object.entries(mapping)) {
        if (colIdx !== undefined && colIdx !== null && colIdx < row.length) {
          let val = row[colIdx]?.trim() || null;
          if (field === "tags" && val) {
            val = val.split(/[,;|]/).map(t => t.trim()).filter(Boolean);
          }
          contact[field] = val;
        }
      }
      if (contact.name) contacts.push(contact);
    }

    // Find duplicates
    const dupeMap = await findDuplicates(contacts);
    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    let errors = 0;
    const errorDetails = [];

    // Insert in batches of 50
    const toInsert = [];
    for (const c of contacts) {
      const isDupe = c.email && dupeMap[c.email.toLowerCase()];
      if (isDupe) {
        duplicates++;
        if (skipDuplicates) {
          skipped++;
          continue;
        }
      }
      toInsert.push({
        name: c.name,
        email: c.email || null,
        phone: c.phone || null,
        company: c.company || null,
        role: c.role || null,
        tags: Array.isArray(c.tags) ? c.tags : (c.tags ? [c.tags] : []),
        notes: c.notes || null,
        source: c.source || "csv-import",
      });
    }

    // Batch insert
    const batchSize = 50;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from("crm_contacts")
        .insert(batch)
        .select("id");

      if (error) {
        errors += batch.length;
        errorDetails.push({ batch: Math.floor(i / batchSize), error: error.message });
      } else {
        imported += (data?.length || batch.length);
      }
    }

    // Record import history
    await supabase.from("crm_import_history").insert({
      type: "csv",
      filename: filename || "upload.csv",
      total_rows: dataRows.length,
      imported,
      skipped,
      duplicates,
      errors,
      column_mapping: mapping,
      error_details: errorDetails.length ? errorDetails : null,
      imported_by: "user",
    });

    res.json({ imported, skipped, duplicates, errors, total: dataRows.length, errorDetails });
  } catch (e) {
    console.error("[Import] CSV confirm error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/import/vcard — Import vCard file ───────────────────────────

importRouter.post("/vcard", async (req, res) => {
  try {
    const { data: vcfData, filename } = req.body;
    if (!vcfData) return res.status(400).json({ error: "data (vCard content) is required" });

    const contacts = parseVCards(vcfData);
    if (contacts.length === 0) return res.status(400).json({ error: "No valid contacts found in vCard file" });

    // Find duplicates
    const dupeMap = await findDuplicates(contacts);
    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    let errors = 0;
    const errorDetails = [];

    const toInsert = [];
    const dupeContacts = [];

    for (const c of contacts) {
      const isDupe = c.email && dupeMap[c.email.toLowerCase()];
      if (isDupe) {
        duplicates++;
        dupeContacts.push({ ...c, existingContact: isDupe });
        skipped++;
        continue;
      }
      toInsert.push({
        name: c.name,
        email: c.email || null,
        phone: c.phone || null,
        company: c.company || null,
        role: c.role || null,
        tags: Array.isArray(c.tags) ? c.tags : [],
        notes: c.notes || null,
        source: c.source || "vcard-import",
      });
    }

    // Batch insert
    const batchSize = 50;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from("crm_contacts")
        .insert(batch)
        .select("id");

      if (error) {
        errors += batch.length;
        errorDetails.push({ batch: Math.floor(i / batchSize), error: error.message });
      } else {
        imported += (data?.length || batch.length);
      }
    }

    // Record import history
    await supabase.from("crm_import_history").insert({
      type: "vcard",
      filename: filename || "contacts.vcf",
      total_rows: contacts.length,
      imported,
      skipped,
      duplicates,
      errors,
      error_details: errorDetails.length ? errorDetails : null,
      imported_by: "user",
    });

    res.json({
      total: contacts.length,
      imported,
      skipped,
      duplicates,
      errors,
      dupeContacts: dupeContacts.slice(0, 20), // Return first 20 dupes for review
      errorDetails,
    });
  } catch (e) {
    console.error("[Import] vCard error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/import/history — Import history log ─────────────────────────

importRouter.get("/history", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    const { data, error, count } = await supabase
      .from("crm_import_history")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ data: data || [], total: count || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
