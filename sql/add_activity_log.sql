-- Activity log table: tracks all field changes on agent_tasks (Jira-style)
-- Apply via Supabase Dashboard SQL Editor

-- 1. Create the activity log table
CREATE TABLE IF NOT EXISTS task_activity_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     uuid NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  field       text NOT NULL,
  old_value   text,
  new_value   text,
  changed_by  text,          -- agent name or 'system' or 'dashboard'
  changed_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by task
CREATE INDEX IF NOT EXISTS idx_task_activity_log_task_id ON task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_changed_at ON task_activity_log(task_id, changed_at DESC);

-- 2. Trigger function: log every field change on agent_tasks
CREATE OR REPLACE FUNCTION log_task_field_changes()
RETURNS TRIGGER AS $$
DECLARE
  _field text;
  _old   text;
  _new   text;
  _actor text;
  _tracked_fields text[] := ARRAY[
    'status', 'title', 'description', 'type', 'priority',
    'assigned_agent', 'stage', 'acceptance_criteria',
    'dispatched_by', 'result', 'error', 'qa_result',
    'project_id', 'repository_id', 'blocked_reason'
  ];
BEGIN
  -- Determine actor: use assigned_agent if status changed to in_progress/running,
  -- or the new assigned_agent, or 'system'
  _actor := COALESCE(
    CASE
      WHEN NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('in_progress', 'running', 'qa_testing', 'completed', 'failed')
        THEN COALESCE(NEW.assigned_agent, OLD.assigned_agent)
      WHEN NEW.assigned_agent IS DISTINCT FROM OLD.assigned_agent
        THEN NEW.assigned_agent
      ELSE NULL
    END,
    COALESCE(NEW.dispatched_by, 'system')
  );

  FOREACH _field IN ARRAY _tracked_fields LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', _field, _field)
      INTO _old, _new
      USING OLD, NEW;

    IF _old IS DISTINCT FROM _new THEN
      INSERT INTO task_activity_log (task_id, field, old_value, new_value, changed_by, changed_at)
      VALUES (NEW.id, _field, _old, _new, _actor, now());
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS trg_log_task_field_changes ON agent_tasks;
CREATE TRIGGER trg_log_task_field_changes
  AFTER UPDATE ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_field_changes();

-- 4. Also log task creation
CREATE OR REPLACE FUNCTION log_task_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO task_activity_log (task_id, field, old_value, new_value, changed_by, changed_at)
  VALUES (NEW.id, 'created', NULL, NEW.status, COALESCE(NEW.dispatched_by, 'system'), now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_task_created ON agent_tasks;
CREATE TRIGGER trg_log_task_created
  AFTER INSERT ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_created();
