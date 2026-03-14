-- Migration 0012: Add build_steps column to apps table
-- Tracks per-step status for the App Factory scaffold pipeline
-- Each step: {id, status, started_at, completed_at, error}
ALTER TABLE apps ADD COLUMN IF NOT EXISTS build_steps jsonb DEFAULT '[]'::jsonb;

-- Add index for faster lookups if needed in the future
COMMENT ON COLUMN apps.build_steps IS 'JSON array tracking App Factory scaffold pipeline step statuses: [{id, status, started_at, completed_at, error}]';
