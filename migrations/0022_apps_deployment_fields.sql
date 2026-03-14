-- Migration 0022: Add deployment fields to apps table
-- Task: 50ebee28-0183-44bc-ae5a-7873ca2fb157
-- Tracks live URL, deployment status, and last deploy timestamp for the App Factory.

ALTER TABLE apps ADD COLUMN IF NOT EXISTS deployment_url TEXT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS deployment_status TEXT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS last_deployed_at TIMESTAMPTZ;

COMMENT ON COLUMN apps.deployment_url IS 'Live URL of the deployed app (e.g. https://my-app.vercel.app)';
COMMENT ON COLUMN apps.deployment_status IS 'App-level deployment state: building | deploying | live | failed';
COMMENT ON COLUMN apps.last_deployed_at IS 'Timestamp when the app last reached live/deployed state';
