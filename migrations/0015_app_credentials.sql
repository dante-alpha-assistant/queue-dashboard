-- Migration: Populate per-repo deploy targets and credential requirements
-- Task: 6d770941-f8ef-41e8-abd3-b94bb864bcf0
--
-- Schema notes:
--   apps.required_credentials is jsonb with shape {"coding": [...], "qa": [...]}
--   agent_cards.available_credentials is text[]
-- Both columns already exist; this migration seeds them with real data.

-- 1. Seed agent_cards credentials
UPDATE agent_cards SET available_credentials = ARRAY['GH_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_MGMT_TOKEN']
  WHERE id = 'neo-worker';

UPDATE agent_cards SET available_credentials = ARRAY['GH_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_MGMT_TOKEN', 'VERCEL_TOKEN']
  WHERE id = 'ifra-worker';

UPDATE agent_cards SET available_credentials = ARRAY['GH_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_MGMT_TOKEN']
  WHERE id = 'beta-worker';

-- 2. Seed apps with per-app credential requirements
UPDATE apps SET required_credentials = '{"coding": ["GH_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"], "qa": ["GH_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"]}'::jsonb
  WHERE slug = 'queue-dashboard';

UPDATE apps SET required_credentials = '{"coding": ["GH_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"], "qa": ["GH_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"]}'::jsonb
  WHERE slug = 'dante-crm';

UPDATE apps SET required_credentials = '{"coding": ["GH_TOKEN", "VERCEL_TOKEN"], "qa": ["GH_TOKEN"]}'::jsonb
  WHERE slug = 'game-landing';

UPDATE apps SET required_credentials = '{"coding": ["GH_TOKEN"], "qa": ["GH_TOKEN"]}'::jsonb
  WHERE slug = 'task-dispatcher';

UPDATE apps SET required_credentials = '{"coding": ["GH_TOKEN"], "qa": ["GH_TOKEN"]}'::jsonb
  WHERE slug = 'agent-skills';

UPDATE apps SET required_credentials = '{"coding": ["GH_TOKEN"], "qa": ["GH_TOKEN"]}'::jsonb
  WHERE slug = 'gitops';
