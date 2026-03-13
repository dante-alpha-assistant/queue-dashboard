-- Migration: 0017_apps_repo_source_architecture
-- Add repo_source and repo_architecture columns to apps table
-- repo_source: "scratch" | "github" — how the repo(s) were configured
-- repo_architecture: jsonb — AI-proposed repo structure for scratch mode
-- e.g. [{"name": "my-app-frontend", "role": "Frontend"}, {"name": "my-app-api", "role": "Backend API"}]

ALTER TABLE apps ADD COLUMN IF NOT EXISTS repo_source text DEFAULT 'scratch';
ALTER TABLE apps ADD COLUMN IF NOT EXISTS repo_architecture jsonb DEFAULT NULL;

-- Index for filtering by repo_source
CREATE INDEX IF NOT EXISTS idx_apps_repo_source ON apps(repo_source);
