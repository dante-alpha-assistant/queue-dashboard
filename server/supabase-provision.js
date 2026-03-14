// server/supabase-provision.js — Supabase per-app project provisioning for App Factory
//
// Each app gets its own isolated Supabase project:
//   1. Create new Supabase project via Management API (POST /v1/projects)
//   2. Wait until project reaches ACTIVE_HEALTHY status
//   3. Use AI to generate appropriate tables + SQL migrations
//   4. Run migrations via SQL API (POST /v1/projects/{ref}/database/query)
//   5. Enable Row Level Security on all tables
//   6. Run E2E tests: CRUD, RLS enforcement, key validation
//   7. Inject env vars into Vercel project using per-app credentials

const SUPABASE_MGMT_TOKEN = process.env.SUPABASE_MGMT_TOKEN || 'sbp_1bba539cc0f681dba9fd333d4dc1fbdb3b9db972';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GH_TOKEN = process.env.GH_TOKEN;

// Default region for new projects
const DEFAULT_REGION = 'us-east-1';

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
 * Generate a random DB password (32 chars).
 */
function generateDbPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let pwd = '';
  // Ensure at least one uppercase, lowercase, digit, special char
  pwd += 'ABCDE'.charAt(Math.floor(Math.random() * 5));
  pwd += 'abcde'.charAt(Math.floor(Math.random() * 5));
  pwd += '01234'.charAt(Math.floor(Math.random() * 5));
  pwd += '!@#$%'.charAt(Math.floor(Math.random() * 5));
  for (let i = 4; i < 32; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Shuffle
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Get the first organization ID from Supabase Management API.
 */
async function getOrgId() {
  const resp = await fetch('https://api.supabase.com/v1/organizations', {
    headers: { Authorization: `Bearer ${SUPABASE_MGMT_TOKEN}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to get Supabase orgs (${resp.status}): ${text}`);
  }
  const orgs = await resp.json();
  if (!orgs || orgs.length === 0) {
    throw new Error('No Supabase organizations found for this management token');
  }
  return orgs[0].id;
}

/**
 * Create a new Supabase project via Management API.
 * @param {string} slug - App slug (used as project name)
 * @param {string} orgId - Supabase organization ID
 * @returns {Promise<{ref: string, name: string}>}
 */
async function createSupabaseProject(slug, orgId) {
  const dbPass = generateDbPassword();

  const body = {
    name: slug,
    db_pass: dbPass,
    region: DEFAULT_REGION,
    organization_id: orgId,
  };

  const resp = await fetch('https://api.supabase.com/v1/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_MGMT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Failed to create Supabase project (${resp.status}): ${text}`);
  }

  const data = JSON.parse(text);
  console.log(`[SUPABASE-PROVISION] Project created: ref=${data.id || data.ref}, name=${data.name}`);
  return { ref: data.id || data.ref, name: data.name, dbPass };
}

/**
 * Wait until the Supabase project reaches ACTIVE_HEALTHY status.
 * @param {string} ref - Project ref
 * @param {number} timeoutMs - Max wait time (default 5 min)
 * @returns {Promise<{ref, url, anonKey, serviceRoleKey}>}
 */
export async function waitForProjectReady(ref, timeoutMs = 300000) {
  const start = Date.now();
  const pollInterval = 10000; // 10s

  while (Date.now() - start < timeoutMs) {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
      headers: { Authorization: `Bearer ${SUPABASE_MGMT_TOKEN}` },
    });

    if (resp.ok) {
      const data = await resp.json();
      console.log(`[SUPABASE-PROVISION] Project ${ref} status: ${data.status}`);

      if (data.status === 'ACTIVE_HEALTHY') {
        // Get API keys
        const keysResp = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
          headers: { Authorization: `Bearer ${SUPABASE_MGMT_TOKEN}` },
        });

        let anonKey = null;
        let serviceRoleKey = null;

        if (keysResp.ok) {
          const keys = await keysResp.json();
          for (const k of keys) {
            if (k.name === 'anon') anonKey = k.api_key;
            if (k.name === 'service_role') serviceRoleKey = k.api_key;
          }
        }

        return {
          ref,
          url: `https://${ref}.supabase.co`,
          anonKey,
          serviceRoleKey,
        };
      }

      // Still provisioning — wait and retry
      if (data.status === 'COMING_UP' || data.status === 'UNKNOWN' || data.status === 'RESTORING') {
        await new Promise((r) => setTimeout(r, pollInterval));
        continue;
      }

      // Fatal status
      throw new Error(`Supabase project ${ref} in unexpected status: ${data.status}`);
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  throw new Error(`Supabase project ${ref} did not become ACTIVE_HEALTHY within ${timeoutMs / 1000}s`);
}

/**
 * Run SQL against a Supabase project via Management API.
 * @param {string} ref - Project ref
 * @param {string} sql - SQL to execute
 */
export async function runSQLOnProject(ref, sql) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_MGMT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Supabase SQL error on project ${ref} (${resp.status}): ${text}`);
  }
  return text;
}

/**
 * Generate CREATE TABLE SQL for the app using AI.
 * Falls back to a generic template if OpenAI is unavailable.
 * @param {string} appSlug - App slug
 * @param {string} description - App description
 * @returns {Promise<string>} SQL DDL string
 */
export async function generateTablesSQL(appSlug, description) {
  if (!OPENAI_API_KEY) {
    console.warn('[SUPABASE-PROVISION] OPENAI_API_KEY not set — using generic table template');
    return genericTablesSQL(appSlug);
  }

  const prompt = `Generate PostgreSQL CREATE TABLE statements for a "${appSlug}" app described as: "${description}"

Requirements:
- Create 2-4 tables appropriate for this app
- All tables in the public schema (no schema prefix)
- Every table must have:
  - id UUID DEFAULT gen_random_uuid() PRIMARY KEY
  - created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  - user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
- Add other columns appropriate for the app (VARCHAR, TEXT, BOOLEAN, INTEGER, JSONB)
- Use CREATE TABLE IF NOT EXISTS for idempotency
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
    if (!sql || sql.length < 50) return genericTablesSQL(appSlug);
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
CREATE TABLE IF NOT EXISTS records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1'
);`;
}

/**
 * Enable Row Level Security on tables.
 * @param {string} ref - Project ref
 * @param {string[]} tableNames - Table names
 */
async function enableRLS(ref, tableNames) {
  for (const table of tableNames) {
    const sql = `
ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = '${table}'
      AND policyname = 'Users can access own data'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can access own data" ON public.${table} FOR ALL USING (auth.uid() = user_id)';
  END IF;
END
$$;`;

    try {
      await runSQLOnProject(ref, sql);
    } catch (err) {
      console.warn(`[SUPABASE-PROVISION] RLS setup failed for ${table}: ${err.message}`);
    }
  }
}

/**
 * Create necessary indexes on generated tables.
 * @param {string} ref - Project ref
 * @param {string[]} tableNames - Table names
 */
async function createIndexes(ref, tableNames) {
  for (const table of tableNames) {
    const sql = `
CREATE INDEX IF NOT EXISTS idx_${table}_user_id ON public.${table}(user_id);
CREATE INDEX IF NOT EXISTS idx_${table}_created_at ON public.${table}(created_at DESC);`;
    try {
      await runSQLOnProject(ref, sql);
    } catch (err) {
      console.warn(`[SUPABASE-PROVISION] Index creation failed for ${table}: ${err.message}`);
    }
  }
}

/**
 * Run E2E tests against a provisioned Supabase project.
 * Tests: accessibility, CRUD via service_role, RLS blocks anon access.
 * @param {string} ref - Project ref
 * @param {string} url - Project URL
 * @param {string} anonKey - Anonymous API key
 * @param {string} serviceRoleKey - Service role key
 * @param {string[]} tables - Table names to test
 * @returns {Promise<object>} Test results
 */
export async function runE2ETests(ref, url, anonKey, serviceRoleKey, tables) {
  const results = {
    projectAccessible: false,
    rlsBlocksAnon: false,
    serviceRoleBypassesRls: false,
    anonKeyWorks: false,
    crudTests: {},
    passed: 0,
    failed: 0,
  };

  // Test 1: Project accessible via URL (anon key)
  try {
    const resp = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: anonKey || '',
        Authorization: `Bearer ${anonKey || ''}`,
      },
    });
    results.projectAccessible = resp.ok || resp.status === 400; // 400 means auth works but no table specified
    results.anonKeyWorks = resp.ok || resp.status === 400 || resp.status === 200;
  } catch (e) {
    results.projectAccessible = false;
    results.accessError = e.message;
  }

  if (results.projectAccessible) results.passed++;
  else results.failed++;

  // Test each table (max 2)
  const testTables = tables.slice(0, 2);
  for (const table of testTables) {
    const tableResults = {
      insertWithServiceRole: false,
      selectWithServiceRole: false,
      rlsBlocksAnonSelect: false,
    };

    // Test: service_role_key can INSERT
    try {
      const resp = await fetch(`${url}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey || '',
          Authorization: `Bearer ${serviceRoleKey || ''}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          title: 'E2E test record',
          status: 'test',
          user_id: '00000000-0000-0000-0000-000000000000',
        }),
      });
      tableResults.insertWithServiceRole = resp.ok || resp.status === 201;
    } catch (e) {
      tableResults.insertError = e.message;
    }

    // Test: service_role_key can SELECT (bypasses RLS)
    try {
      const resp = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          apikey: serviceRoleKey || '',
          Authorization: `Bearer ${serviceRoleKey || ''}`,
        },
      });
      tableResults.selectWithServiceRole = resp.ok;
    } catch (e) {
      tableResults.selectError = e.message;
    }

    // Test: anon_key SELECT is blocked by RLS (expect empty array since no auth.uid())
    try {
      const resp = await fetch(`${url}/rest/v1/${table}?select=*`, {
        headers: {
          apikey: anonKey || '',
          Authorization: `Bearer ${anonKey || ''}`,
        },
      });
      if (resp.status === 401 || resp.status === 403) {
        tableResults.rlsBlocksAnonSelect = true;
      } else if (resp.ok) {
        const data = await resp.json();
        // RLS policy filters by auth.uid() — anon has no uid, so should return empty
        tableResults.rlsBlocksAnonSelect = Array.isArray(data) && data.length === 0;
      }
    } catch (e) {
      tableResults.rlsError = e.message;
    }

    results.crudTests[table] = tableResults;

    if (tableResults.insertWithServiceRole) results.passed++;
    else results.failed++;
    if (tableResults.rlsBlocksAnonSelect) results.passed++;
    else results.failed++;
  }

  results.rlsBlocksAnon = testTables.length === 0 ||
    testTables.every((t) => results.crudTests[t]?.rlsBlocksAnonSelect);
  results.serviceRoleBypassesRls = testTables.length === 0 ||
    testTables.some((t) => results.crudTests[t]?.selectWithServiceRole);

  return results;
}

/**
 * Inject Supabase env vars into a Vercel project using per-app credentials.
 * @param {string} vercelProjectId - Vercel project ID
 * @param {string} vercelToken - Vercel API token
 * @param {string} supabaseUrl - App's Supabase project URL
 * @param {string} anonKey - App's anon key
 * @param {string} serviceRoleKey - App's service role key
 */
export async function injectVercelEnvVars(vercelProjectId, vercelToken, supabaseUrl, anonKey, serviceRoleKey) {
  const targets = ['production', 'preview', 'development'];

  const envVars = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseUrl },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: anonKey || '' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: serviceRoleKey || '' },
  ];

  for (const envVar of envVars) {
    if (!envVar.value) continue;
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
          type: 'encrypted',
          target: targets,
        }),
      });

      if (resp.ok) {
        console.log(`[SUPABASE-PROVISION] Vercel env var set: ${envVar.key}`);
      } else {
        const text = await resp.text();
        // If already exists, try updating it
        if (resp.status === 400 && text.includes('already exists')) {
          console.log(`[SUPABASE-PROVISION] Env var ${envVar.key} already exists, skipping`);
        } else {
          console.warn(`[SUPABASE-PROVISION] Failed to set ${envVar.key}: ${resp.status} ${text}`);
        }
      }
    } catch (err) {
      console.warn(`[SUPABASE-PROVISION] Error setting ${envVar.key}: ${err.message}`);
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
 * Main entry point: create a dedicated Supabase project for an app.
 * Creates project → waits for ACTIVE_HEALTHY → generates schema → runs migrations → RLS → E2E tests.
 *
 * @param {string} appSlug - App slug (used as project name)
 * @param {string} description - App description (used for AI schema generation)
 * @returns {Promise<{ref, url, anonKey, serviceRoleKey, tables, sql, e2eResults}>}
 */
export async function createAppSupabaseProject(appSlug, description) {
  if (!SUPABASE_MGMT_TOKEN) {
    throw new Error('SUPABASE_MGMT_TOKEN is not configured');
  }

  // 1. Get organization ID
  console.log(`[SUPABASE-PROVISION] Getting org ID...`);
  const orgId = await getOrgId();
  console.log(`[SUPABASE-PROVISION] Org ID: ${orgId}`);

  // 2. Create the project
  console.log(`[SUPABASE-PROVISION] Creating Supabase project: ${appSlug}`);
  const { ref } = await createSupabaseProject(appSlug, orgId);

  // 3. Wait for project to be ready
  console.log(`[SUPABASE-PROVISION] Waiting for project ${ref} to be ACTIVE_HEALTHY...`);
  const { url, anonKey, serviceRoleKey } = await waitForProjectReady(ref);
  console.log(`[SUPABASE-PROVISION] Project ready: ${url}`);

  // 4. Generate schema SQL
  console.log(`[SUPABASE-PROVISION] Generating schema for "${appSlug}"...`);
  const sql = await generateTablesSQL(appSlug, description);
  console.log(`[SUPABASE-PROVISION] Schema SQL generated (${sql.length} chars)`);

  // 5. Run migrations
  await runSQLOnProject(ref, sql);
  console.log(`[SUPABASE-PROVISION] Migrations executed on project ${ref}`);

  // 6. Extract table names from SQL
  const tableRegex = /CREATE TABLE IF NOT EXISTS\s+(?:public\.)?(\w+)\s*\(/gi;
  const tables = [];
  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    tables.push(match[1]);
  }
  console.log(`[SUPABASE-PROVISION] Tables detected: ${tables.join(', ')}`);

  // 7. Enable RLS + create indexes
  if (tables.length > 0) {
    await enableRLS(ref, tables);
    await createIndexes(ref, tables);
    console.log(`[SUPABASE-PROVISION] RLS + indexes configured for tables: ${tables.join(', ')}`);
  }

  // 8. Run E2E tests
  console.log(`[SUPABASE-PROVISION] Running E2E tests on project ${ref}...`);
  let e2eResults = null;
  try {
    e2eResults = await runE2ETests(ref, url, anonKey, serviceRoleKey, tables);
    console.log(`[SUPABASE-PROVISION] E2E tests: ${e2eResults.passed} passed, ${e2eResults.failed} failed`);
  } catch (e2eErr) {
    console.warn(`[SUPABASE-PROVISION] E2E tests failed (non-fatal): ${e2eErr.message}`);
  }

  return { ref, url, anonKey, serviceRoleKey, tables, sql, e2eResults };
}

// ---------------------------------------------------------------------------
// Legacy compatibility: provisionSupabase still available for backward compat
// but now it redirects to per-project provisioning
// ---------------------------------------------------------------------------

/**
 * @deprecated Use createAppSupabaseProject instead.
 * Kept for backward compatibility — redirects to per-project provisioning.
 */
export async function provisionSupabase(appSlug, description) {
  const result = await createAppSupabaseProject(appSlug, description);
  return {
    schema: appSlug,
    tables: result.tables,
    sql: result.sql,
    ref: result.ref,
    url: result.url,
    anonKey: result.anonKey,
    serviceRoleKey: result.serviceRoleKey,
  };
}
