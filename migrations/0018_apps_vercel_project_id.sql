-- Migration: 0018_apps_vercel_project_id
-- Add vercel_project_id and vercel_preview_url columns to apps table
-- These are populated automatically when deploy_target=vercel via the Vercel API

ALTER TABLE apps ADD COLUMN IF NOT EXISTS vercel_project_id text DEFAULT NULL;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS vercel_preview_url text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_apps_vercel_project_id ON apps(vercel_project_id);
