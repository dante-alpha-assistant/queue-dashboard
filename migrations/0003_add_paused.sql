-- Add paused flag for Stop/Resume functionality
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS paused boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_agent_tasks_paused ON agent_tasks(paused) WHERE paused = true;
