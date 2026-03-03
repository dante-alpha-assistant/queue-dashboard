-- Task comments table: replaces Response/instructions with a full comment thread
-- Apply via Supabase Dashboard SQL Editor

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  author TEXT NOT NULL,          -- 'dante', 'neo-worker', 'beta-worker', 'system', etc.
  author_type TEXT NOT NULL DEFAULT 'human',  -- 'human', 'agent', 'system'
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by task
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created ON task_comments(task_id, created_at ASC);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE task_comments;

-- RLS: service role has full access (no row-level restrictions needed for internal tool)
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON task_comments
  FOR ALL USING (true) WITH CHECK (true);
