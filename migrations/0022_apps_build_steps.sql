-- Migration: add build_steps JSONB column to apps table
-- Each step: { id, status, updated_at }
-- Step IDs match AppBuildProgress.jsx STAGES: github_repo, scaffold, ai_codegen,
--   vercel_setup, vercel_deploy, first_deploy, live
ALTER TABLE apps ADD COLUMN IF NOT EXISTS build_steps jsonb DEFAULT '[]'::jsonb;
