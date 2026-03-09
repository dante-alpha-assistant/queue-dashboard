-- Add metadata JSONB column for extensible task metadata
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
