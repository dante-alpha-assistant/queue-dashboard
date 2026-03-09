import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run pending database migrations from the migrations/ folder.
 * Tracks applied migrations in a _migrations table.
 */
export async function runMigrations(supabase) {
  const migrationsDir = path.join(__dirname, "..", "migrations");
  
  if (!fs.existsSync(migrationsDir)) {
    console.log("[MIGRATE] No migrations/ folder found — skipping");
    return { applied: [], skipped: [] };
  }

  const MGMT_URL = `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID || "lessxkxujvcmublgwdaa"}/database/query`;
  const MGMT_TOKEN = process.env.SUPABASE_MGMT_TOKEN || "";
  const headers = { "Authorization": `Bearer ${MGMT_TOKEN}`, "Content-Type": "application/json" };

  if (!MGMT_TOKEN) {
    console.log("[MIGRATE] No SUPABASE_MGMT_TOKEN — skipping migrations");
    return { applied: [], skipped: [] };
  }

  // Ensure _migrations tracking table exists
  await fetch(MGMT_URL, { method: "POST", headers, body: JSON.stringify({ query: "CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now());" }) });

  // Get already-applied migrations
  const { data: applied } = await supabase.from("_migrations").select("name");
  const appliedSet = new Set((applied || []).map(r => r.name));

  // Read and sort migration files
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();
  const results = { applied: [], skipped: [] };

  for (const file of files) {
    if (appliedSet.has(file)) {
      results.skipped.push(file);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8").trim();
    if (!sql) continue;

    console.log(`[MIGRATE] Running: ${file}`);
    const resp = await fetch(MGMT_URL, { method: "POST", headers, body: JSON.stringify({ query: sql }) });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[MIGRATE] FAILED: ${file} — ${errText}`);
      results.error = `Migration ${file} failed`;
      break;
    }

    await supabase.from("_migrations").insert({ name: file });
    console.log(`[MIGRATE] Applied: ${file}`);
    results.applied.push(file);
  }

  if (results.applied.length > 0 || results.skipped.length > 0) {
    console.log(`[MIGRATE] Done: ${results.applied.length} applied, ${results.skipped.length} skipped`);
  }
  return results;
}
