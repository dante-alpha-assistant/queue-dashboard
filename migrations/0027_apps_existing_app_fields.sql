-- Migration: Add existing_repo_url and existing_deploy_url to apps table
-- These fields store external repo/deploy info for apps created with repo_source = 'existing'
ALTER TABLE apps ADD COLUMN IF NOT EXISTS existing_repo_url text;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS existing_deploy_url text;
