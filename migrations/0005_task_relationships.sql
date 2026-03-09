-- Task relationships table (like Jira task links)
-- Relationship types: depends_on, blocks, related_to, subtask_of
CREATE TABLE IF NOT EXISTS task_relationships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_task_id uuid NOT NULL REFERENCES agent_tasks(id),
  target_task_id uuid NOT NULL REFERENCES agent_tasks(id),
  relationship_type text NOT NULL DEFAULT 'depends_on',
  created_at timestamptz DEFAULT now(),
  created_by text,
  UNIQUE(source_task_id, target_task_id, relationship_type),
  CHECK(source_task_id != target_task_id)
);
CREATE INDEX IF NOT EXISTS idx_task_rel_source ON task_relationships(source_task_id);
CREATE INDEX IF NOT EXISTS idx_task_rel_target ON task_relationships(target_task_id);
