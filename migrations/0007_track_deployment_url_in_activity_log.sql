-- Add deployment_url to the activity log trigger's tracked fields
-- Re-create the trigger function with deployment_url included

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
    'project_id', 'repository_id', 'blocked_reason',
    'deployment_url'
  ];
BEGIN
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
