-- Migration: 0020_apps_vercel_deploy_tracking
-- Track Vercel deployment ID and status for App Factory apps.
-- Needed so the UI can show accurate deploy state (not just "project exists").
-- Task: 4517103f-f56c-4dbd-9d6c-7b245463fa85

-- vercel_deploy_id: The Vercel deployment ID (e.g. "dpl_abc123")
ALTER TABLE apps ADD COLUMN IF NOT EXISTS vercel_deploy_id text DEFAULT NULL;

-- vercel_deploy_status: The last known Vercel deployment state
-- Valid values: 'deploying' | 'ready' | 'error' | 'canceled'
ALTER TABLE apps ADD COLUMN IF NOT EXISTS vercel_deploy_status text DEFAULT NULL;

COMMENT ON COLUMN apps.vercel_deploy_id IS 'Vercel deployment ID (e.g. dpl_xxx) set when scaffold triggers the initial deploy';
COMMENT ON COLUMN apps.vercel_deploy_status IS 'Last known Vercel deploy state: deploying | ready | error | canceled';
