-- idempotent
CREATE TABLE IF NOT EXISTS dispatcher_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- Enable RLS
ALTER TABLE dispatcher_config ENABLE ROW LEVEL SECURITY;

-- Read for all authenticated users
DO $$ BEGIN
  CREATE POLICY "dispatcher_config_read" ON dispatcher_config
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Write only for admin
DO $$ BEGIN
  CREATE POLICY "dispatcher_config_write" ON dispatcher_config
    FOR ALL TO authenticated
    USING (auth.jwt() ->> 'email' = 'dante.perea@unifounder.ai')
    WITH CHECK (auth.jwt() ->> 'email' = 'dante.perea@unifounder.ai');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed defaults
INSERT INTO dispatcher_config (key, value, updated_by)
VALUES 
  ('global_user_concurrency_limit', '2'::jsonb, 'system'),
  ('agent_user_concurrency_limits', '{"neo-worker": 1, "beta-worker": 1, "ifra-worker": 1, "research-worker": 1, "setup-agent": 1}'::jsonb, 'system')
ON CONFLICT (key) DO NOTHING;
