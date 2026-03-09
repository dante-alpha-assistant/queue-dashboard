-- Auto-create a comment when the error field is set on a task
CREATE OR REPLACE FUNCTION auto_comment_on_error()
RETURNS TRIGGER AS $$
DECLARE
  _agent TEXT;
  _comment_body TEXT;
BEGIN
  IF OLD.error IS NOT NULL OR NEW.error IS NULL THEN
    RETURN NEW;
  END IF;

  _agent := COALESCE(NEW.assigned_agent, OLD.assigned_agent, 'system');
  _comment_body := '❌ Error' || E'\n\n' || NEW.error;

  INSERT INTO task_comments (task_id, author, author_type, body)
  VALUES (NEW.id, _agent, 'agent', _comment_body);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_comment_on_error ON agent_tasks;
CREATE TRIGGER trg_auto_comment_on_error
  AFTER UPDATE ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_comment_on_error();
