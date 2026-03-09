-- Add repository_url column for tracking task repos
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS repository_url text;
