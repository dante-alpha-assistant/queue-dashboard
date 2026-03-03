-- Add soft delete (removed) column to agent_tasks
-- Tasks with removed=true are hidden from dashboard by default but never deleted
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS removed boolean DEFAULT false;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_agent_tasks_removed ON agent_tasks (removed) WHERE removed = true;
