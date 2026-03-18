-- App-level credentials table for secure, app-scoped credential storage
-- Task: 32f873d1-33c7-40f7-a768-ce41391f424e
-- Replaces agent-level credential storage with app-scoped credential management.
-- Agents dynamically receive credentials based on the task's app_id.

CREATE TABLE IF NOT EXISTS app_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  credential_name TEXT NOT NULL,
  credential_type TEXT NOT NULL DEFAULT 'secret',
  k8s_secret_name TEXT,
  k8s_secret_key TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(app_id, credential_name)
);

CREATE INDEX IF NOT EXISTS idx_app_credentials_app_id ON app_credentials(app_id);

-- Seed queue-dashboard app credentials
INSERT INTO app_credentials (app_id, credential_name, credential_type, k8s_secret_name, k8s_secret_key, description)
SELECT
  id,
  'SUPABASE_SERVICE_ROLE_KEY',
  'secret',
  'dashboard-secrets',
  'supabase-key',
  'Supabase service role key for database access'
FROM apps WHERE slug = 'queue-dashboard'
ON CONFLICT (app_id, credential_name) DO NOTHING;

INSERT INTO app_credentials (app_id, credential_name, credential_type, k8s_secret_name, k8s_secret_key, description)
SELECT
  id,
  'GH_TOKEN',
  'token',
  'dashboard-secrets',
  'github-token',
  'GitHub personal access token for repo operations'
FROM apps WHERE slug = 'queue-dashboard'
ON CONFLICT (app_id, credential_name) DO NOTHING;

INSERT INTO app_credentials (app_id, credential_name, credential_type, k8s_secret_name, k8s_secret_key, description)
SELECT
  id,
  'SUPABASE_MGMT_TOKEN',
  'token',
  'dashboard-secrets',
  'supabase-mgmt-token',
  'Supabase Management API token for project provisioning'
FROM apps WHERE slug = 'queue-dashboard'
ON CONFLICT (app_id, credential_name) DO NOTHING;
