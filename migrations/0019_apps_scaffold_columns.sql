-- Migration: 0019_apps_scaffold_columns
-- Add columns needed for the App Factory scaffold pipeline
-- Task: 348078cd-998d-4780-a723-905934499053

-- repo_url: URL to the scaffolded GitHub repo (e.g. https://github.com/dante-alpha-assistant/my-app)
ALTER TABLE apps ADD COLUMN IF NOT EXISTS repo_url TEXT;

-- credentials: JSONB store for per-app secrets/credentials (Vercel token, Supabase keys, etc.)
ALTER TABLE apps ADD COLUMN IF NOT EXISTS credentials JSONB DEFAULT '{}';

-- Ensure apps.status allows scaffold lifecycle values
-- The existing status column may have a CHECK constraint — drop and recreate safely
ALTER TABLE apps DROP CONSTRAINT IF EXISTS apps_status_check;

-- No new CHECK constraint — application layer validates status values
-- Valid lifecycle values: 'scaffolding', 'deploying', 'building', 'live', 'failed', 'active', 'inactive'
