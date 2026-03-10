-- Add index on created_at for time-range queries and pagination performance
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_at ON agent_tasks (created_at DESC);

-- Add index on status for filtering (used heavily in board view)
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks (status);

-- Composite index for the common query pattern: status + created_at
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status_created_at ON agent_tasks (status, created_at DESC);
