// server/supabase-provision.js — Supabase auto-provisioning for App Factory
//
// When an app needs a database, this module:
// 1. Creates a dedicated schema in the shared Supabase project
// 2. Uses AI to generate tables based on app description
// 3. Runs migrations via Supabase Management API
// 4. Sets up Row Level Security
// 5. Injects env vars into Vercel project
// 6. Pushes /src/lib/supabase.ts to the GitHub repo

const SUPABASE_URL = 'https://lessxkxujvcmublgwdaa.supabase.co';
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_ID || 'lessxkxujvcmublgwdaa';
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD; // Optional: enables DATABASE_URL injection
const SUPABASE_MGMT_TOKEN = process.env.SUPABASE_MGMT_TOKEN;
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlc3N4a3h1anZjbXVibGd3ZGFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2MTQ2NSwiZXhwIjoyMDg2OTM3NDY1fQ.Wo2WczTauYjpaqtAzfADTSa5htFF6_cKU4UHaJ1EARI';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlc3N4a3h1anZjbXVibGd3ZGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNjE0NjUsImV4cCI6MjA4NjkzNzQ2NX0.6cJIFWVqSBv-VWElH_yZxPibXE9xCKj3PF-6ZxDI1vI';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GH_TOKEN = process.env.GH_TOKEN;

// Database-related keywords for auto-detection
const DB_KEYWORDS = [
  'user', 'users', 'account', 'accounts', 'login', 'auth', 'authentication',
  'database', 'db', 'store', 'storage', 'save', 'saved', 'track', 'tracking',
  'list', 'manage', 'management', 'crm', 'crud', 'inventory', 'order', 'orders',
  'product', 'products', 'task', 'tasks', 'project', 'projects', 'record', 'records',
  'data', 'dashboard', 'report', 'reporting', 'analytics', 'customer', 'customers',
  'contact', 'contacts', 'message', 'messages', 'post', 'posts', 'comment', 'comments',
  'booking', 'bookings', 'event', 'events', 'payment', 'payments', 'invoice', 'invoices',
  'profile', 'profiles', 'note', 'notes', 'todo', 'todos', 'schedule', 'calendar',
  'employee', 'employees', 'team', 'teams', 'member', 'members', 'subscription',
];

/**
 * Detect if an app needs a database based on its description.
 * @param {string} description - App description
 * @returns {boolean}
 */
export function detectNeedsDatabase(description) {
  if (!description) return false;
  const lower = description.toLowerCase();
  return DB_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Run SQL against Supabase via the Management API.
 * @param {string} sql - SQL to execute
 */
async function runSQL(sql) {
  if (!SUPABASE_MGMT_TOKEN) {
    throw new Error('SUPABASE_MGMT_TOKEN is not configured');
  }

  const resp = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_MGMT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Supabase Management API error (${resp.status}): ${text}`);
  }

  return text;
}

/**
 * Generate CREATE TABLE SQL for the app using AI.
 * Falls back to a generic template if OpenAI is unavailable.
 * @param {string} appSlug - App slug (used as schema name)
 * @param {string} description - App description
 * @returns {Promise<string>} SQL DDL string
 */
async function generateTablesSQL(appSlug, description) {
  if (!OPENAI_API_KEY) {
    console.warn('[SUPABASE-PROVISION] OPENAI_API_KEY not set — using generic table template');
    return genericTablesSQL(appSlug);
  }

  const prompt = `Generate PostgreSQL CREATE TABLE statements for a "${appSlug}" app described as: "${description}"

Requirements:
- Create 2-4 tables appropriate for this app
- All tables must be in the schema "${appSlug}" (e.g., CREATE TABLE IF NOT EXISTS ${appSlug}.contacts (...))
- Every table must have these columns:
  - id UUID DEFAULT gen_random_uuid() PRIMARY KEY
  - created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  - user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
- Add other columns appropriate for the app (VARCHAR, TEXT, BOOLEAN, INTEGER, JSONB, etc.)
- Use IF NOT EXISTS for idempotency
- Return ONLY the SQL statements, no explanations`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!resp.ok) {
      console.warn(`[SUPABASE-PROVISION] OpenAI request failed (${resp.status}) — using generic template`);
      return genericTablesSQL(appSlug);
    }

    const data = await resp.json();
    const sql = data.choices?.[0]?.message?.content?.trim();

    if (!sql || sql.length < 50) {
      return genericTablesSQL(appSlug);
    }

    return sql;
  } catch (err) {
    console.warn(`[SUPABASE-PROVISION] OpenAI error: ${err.message} — using generic template`);
    return genericTablesSQL(appSlug);
  }
}

/**
 * Generic fallback table template.
 */
function genericTablesSQL(appSlug) {
  return `-- Generic tables for ${appSlug}
CREATE TABLE IF NOT EXISTS ${appSlug}.records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS ${appSlug}.tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1'
);`;
}

/**
 * Enable Row Level Security on the given tables.
 * @param {string[]} tableNames
 * @param {string} schema
 */
async function enableRLS(tableNames, schema) {
  for (const table of tableNames) {
    const sql = `
ALTER TABLE ${schema}.${table} ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = '${schema}'
      AND tablename = '${table}'
      AND policyname = 'Users can access own data'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can access own data" ON ${schema}.${table} FOR ALL USING (auth.uid() = user_id)';
  END IF;
END
$$;`;

    try {
      await runSQL(sql);
    } catch (err) {
      // Non-fatal: log and continue
      console.warn(`[SUPABASE-PROVISION] RLS setup failed for ${schema}.${table}: ${err.message}`);
    }
  }
}

/**
 * Push a file to a GitHub repository via the Contents API.
 * @param {string} repoFullName - e.g. "dante-alpha-assistant/my-app"
 * @param {string} filePath - e.g. "src/lib/supabase.ts"
 * @param {string} content - File content (plain text)
 * @param {string} message - Commit message
 */
export async function pushFileToGitHub(repoFullName, filePath, content, message) {
  if (!GH_TOKEN) {
    throw new Error('GH_TOKEN not configured');
  }

  const GH_API = 'https://api.github.com';
  const headers = {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  // Check if file already exists (to get its sha for update)
  let sha;
  try {
    const existResp = await fetch(`${GH_API}/repos/${repoFullName}/contents/${filePath}`, { headers });
    if (existResp.ok) {
      const existing = await existResp.json();
      sha = existing.sha;
    }
  } catch (_) {
    // File doesn't exist — that's fine
  }

  const body = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
  };
  if (sha) body.sha = sha;

  const resp = await fetch(`${GH_API}/repos/${repoFullName}/contents/${filePath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`GitHub file push error (${resp.status}): ${errText}`);
  }
}

/**
 * Provision a dedicated Supabase schema and tables for an app.
 * @param {string} appSlug - App slug (used as schema name)
 * @param {string} description - App description
 * @returns {Promise<{schema: string, tables: string[], sql: string}>}
 */
export async function provisionSupabase(appSlug, description) {
  // 1. Create schema
  await runSQL(`CREATE SCHEMA IF NOT EXISTS ${appSlug};`);
  console.log(`[SUPABASE-PROVISION] Schema created: ${appSlug}`);

  // 2. Generate tables SQL
  const tablesSql = await generateTablesSQL(appSlug, description);
  console.log(`[SUPABASE-PROVISION] Generated SQL for ${appSlug}`);

  // 3. Run tables migration
  await runSQL(tablesSql);
  console.log(`[SUPABASE-PROVISION] Tables created in schema ${appSlug}`);

  // 4. Extract table names from generated SQL
  const tableRegex = /CREATE TABLE IF NOT EXISTS\s+\w+\.(\w+)\s*\(/gi;
  const tableNames = [];
  let match;
  while ((match = tableRegex.exec(tablesSql)) !== null) {
    tableNames.push(match[1]);
  }

  // 5. Enable RLS
  if (tableNames.length > 0) {
    await enableRLS(tableNames, appSlug);
    console.log(`[SUPABASE-PROVISION] RLS enabled for tables: ${tableNames.join(', ')}`);
  }

  return { schema: appSlug, tables: tableNames, sql: tablesSql };
}

/**
 * Inject Supabase env vars into a Vercel project.
 * @param {string} vercelProjectId - Vercel project ID
 * @param {string} vercelToken - Vercel API token
 * @param {string} appSlug - App slug (used in DATABASE_URL schema)
 */
export async function injectVercelEnvVars(vercelProjectId, vercelToken, appSlug) {
  const targets = ['production', 'preview', 'development'];

  const envVars = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: SUPABASE_URL },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: SUPABASE_ANON_KEY },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: SUPABASE_SERVICE_KEY },
  ];

  // DATABASE_URL: inject if SUPABASE_DB_PASSWORD is configured.
  // Uses the Supabase transaction pooler with search_path set to the app schema.
  // Region is inferred from project ref (ap-southeast-2 for this project).
  if (SUPABASE_DB_PASSWORD) {
    const region = 'ap-southeast-2'; // matches lessxkxujvcmublgwdaa project
    const databaseUrl = `postgresql://postgres.${SUPABASE_PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&search_path=${appSlug}`;
    envVars.push({ key: 'DATABASE_URL', value: databaseUrl });
  } else {
    console.warn('[SUPABASE-PROVISION] SUPABASE_DB_PASSWORD not set — skipping DATABASE_URL injection');
  }

  for (const envVar of envVars) {
    try {
      const resp = await fetch(`https://api.vercel.com/v10/projects/${vercelProjectId}/env`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: envVar.key,
          value: envVar.value,
          type: 'plain',
          target: targets,
        }),
      });

      if (resp.ok) {
        console.log(`[SUPABASE-PROVISION] Vercel env var set: ${envVar.key}`);
      } else {
        const text = await resp.text();
        console.warn(`[SUPABASE-PROVISION] Failed to set ${envVar.key}: ${resp.status} ${text}`);
      }
    } catch (err) {
      console.warn(`[SUPABASE-PROVISION] Error setting ${envVar.key}: ${err.message}`);
    }
  }
}
