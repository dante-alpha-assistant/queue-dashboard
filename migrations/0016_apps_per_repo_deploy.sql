-- Migration: 0016_apps_per_repo_deploy
-- Per-repo deploy config: add repos_config jsonb column to apps table
-- This stores per-repo deploy targets instead of a single deploy_target per app.
-- The existing deploy_target column and repos text[] are kept for backward compatibility.

-- Add repos_config jsonb column (if not already present)
ALTER TABLE apps ADD COLUMN IF NOT EXISTS repos_config jsonb DEFAULT '[]'::jsonb;

-- Backfill repos_config from existing repos text[] + deploy_target for apps that haven't been migrated yet
UPDATE apps
SET repos_config = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'repo', r,
      'deploy_target', COALESCE(deploy_target, 'none'),
      'deploy_config', COALESCE(deploy_config, '{}'::jsonb)
    )
  )
  FROM unnest(repos) AS r
)
WHERE
  repos IS NOT NULL
  AND array_length(repos, 1) > 0
  AND (repos_config IS NULL OR repos_config = '[]'::jsonb);

-- Create index for jsonb lookups
CREATE INDEX IF NOT EXISTS idx_apps_repos_config ON apps USING GIN (repos_config);
