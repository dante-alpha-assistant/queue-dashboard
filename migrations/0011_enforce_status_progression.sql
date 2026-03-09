-- Migration 0011: Enforce status progression — prevent completed → todo regression
-- Blocks agents from moving tasks backward from completed/deployed states.
-- Only the reopen_task() RPC (called by humans from dashboard) can reopen.

-- 1. Create the enforce_status_progression trigger function
CREATE OR REPLACE FUNCTION enforce_status_progression()
RETURNS TRIGGER AS $$
DECLARE
  allowed_from_completed text[] := ARRAY['deploying', 'deployed', 'deploy_failed'];
  allowed_from_deployed text[] := ARRAY['deploy_failed'];
BEGIN
  -- Only act on status changes
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Block completed → todo/in_progress (regression). 
  -- completed can only go to: deploying, deployed, deploy_failed
  IF OLD.status = 'completed' AND NOT (NEW.status = ANY(allowed_from_completed)) THEN
    -- Check for the reopen bypass flag (set by reopen_task RPC)
    IF current_setting('app.reopen_bypass', true) = 'true' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Status regression blocked: completed → % is not allowed. Use reopen_task() to reopen.', NEW.status;
  END IF;

  -- Block deployed → anything except deploy_failed (deployed is terminal)
  IF OLD.status = 'deployed' AND NOT (NEW.status = ANY(allowed_from_deployed)) THEN
    IF current_setting('app.reopen_bypass', true) = 'true' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Status regression blocked: deployed → % is not allowed. Use reopen_task() to reopen.', NEW.status;
  END IF;

  -- Block qa_result changes once task is completed (prevent post-completion overwrites)
  IF OLD.status = 'completed' AND NEW.qa_result IS DISTINCT FROM OLD.qa_result THEN
    IF current_setting('app.reopen_bypass', true) = 'true' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify qa_result after task is completed. Use reopen_task() to reopen first.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS trg_enforce_status_progression ON agent_tasks;
CREATE TRIGGER trg_enforce_status_progression
  BEFORE UPDATE ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION enforce_status_progression();

-- 3. Create reopen_task() RPC for human-only reopening (called from dashboard)
CREATE OR REPLACE FUNCTION reopen_task(p_task_id uuid, p_reason text DEFAULT 'Reopened by human')
RETURNS json AS $$
DECLARE
  v_task record;
BEGIN
  -- Set bypass flag so the trigger allows the regression
  PERFORM set_config('app.reopen_bypass', 'true', true);

  SELECT id, status, title INTO v_task
  FROM agent_tasks
  WHERE id = p_task_id;

  IF v_task IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Task not found');
  END IF;

  IF v_task.status NOT IN ('completed', 'deployed', 'deploy_failed') THEN
    RETURN json_build_object('ok', false, 'error', 'Task is not in a completed/deployed state');
  END IF;

  -- Reopen: clear agent assignments, reset to todo
  UPDATE agent_tasks
  SET status = 'todo',
      assigned_agent = NULL,
      qa_agent = NULL,
      started_at = NULL,
      completed_at = NULL,
      error = p_reason,
      qa_result = NULL,
      updated_at = now()
  WHERE id = p_task_id;

  -- Log the reopen in activity
  INSERT INTO task_activity_log (task_id, field, old_value, new_value, changed_by, changed_at)
  VALUES (p_task_id, 'status', v_task.status, 'todo', 'human (reopen)', now());

  INSERT INTO task_activity_log (task_id, field, old_value, new_value, changed_by, changed_at)
  VALUES (p_task_id, 'reopen_reason', NULL, p_reason, 'human (reopen)', now());

  -- Reset bypass
  PERFORM set_config('app.reopen_bypass', 'false', true);

  RETURN json_build_object('ok', true, 'task_id', p_task_id, 'previous_status', v_task.status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
