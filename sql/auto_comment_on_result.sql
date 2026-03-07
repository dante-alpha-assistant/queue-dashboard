-- Auto-create a comment when an agent writes a result to a task
-- This makes agent outputs visible in the Comments tab (conversational timeline)
-- Apply via Supabase Dashboard SQL Editor

CREATE OR REPLACE FUNCTION auto_comment_on_result()
RETURNS TRIGGER AS $$
DECLARE
  _agent TEXT;
  _summary TEXT;
  _comment_body TEXT;
  _result JSONB;
BEGIN
  -- Only fire when result changes from NULL to a value
  IF OLD.result IS NOT NULL OR NEW.result IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine agent name
  _agent := COALESCE(NEW.assigned_agent, OLD.assigned_agent, 'system');

  -- Parse result
  IF jsonb_typeof(NEW.result) = 'object' THEN
    _result := NEW.result;
  ELSE
    -- result is stored as text, try to parse
    BEGIN
      _result := NEW.result::jsonb;
    EXCEPTION WHEN OTHERS THEN
      _result := NULL;
    END;
  END IF;

  -- Build human-readable comment
  IF _result IS NOT NULL AND _result ? 'summary' THEN
    _summary := _result->>'summary';
    _comment_body := '📋 Task Result' || E'\n\n' || _summary;

    -- Add artifacts if present
    IF _result ? 'artifacts' AND jsonb_array_length(COALESCE(_result->'artifacts', '[]'::jsonb)) > 0 THEN
      _comment_body := _comment_body || E'\n\n' || '📎 Artifacts: ' || (_result->>'artifacts');
    END IF;

    -- Add test results if present
    IF _result ? 'test_results' AND _result->>'test_results' IS NOT NULL THEN
      _comment_body := _comment_body || E'\n\n' || '🧪 Test Results: ' || (_result->>'test_results');
    END IF;
  ELSE
    -- Fallback: stringify the result
    _comment_body := '📋 Task Result' || E'\n\n' || COALESCE(NEW.result::text, 'No details provided');
  END IF;

  -- Add PR link if present
  IF NEW.pull_request_url IS NOT NULL AND array_length(NEW.pull_request_url, 1) > 0 THEN
    _comment_body := _comment_body || E'\n\n' || '🔗 PR: ' || array_to_string(NEW.pull_request_url, ', ');
  END IF;

  -- Insert the comment
  INSERT INTO task_comments (task_id, author, author_type, body)
  VALUES (NEW.id, _agent, 'agent', _comment_body);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger (fires AFTER update, same as activity log)
DROP TRIGGER IF EXISTS trg_auto_comment_on_result ON agent_tasks;
CREATE TRIGGER trg_auto_comment_on_result
  AFTER UPDATE ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_comment_on_result();
