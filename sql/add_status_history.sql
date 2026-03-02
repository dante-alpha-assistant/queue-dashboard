-- Add status_history JSONB column to track status transitions with timestamps
-- Apply via Supabase Dashboard SQL Editor

-- 1. Add column
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS status_history jsonb DEFAULT '[]';

-- 2. Backfill existing tasks with their current status
UPDATE agent_tasks
SET status_history = jsonb_build_array(
  jsonb_build_object('status', 'todo', 'at', created_at),
  CASE WHEN status != 'todo' THEN jsonb_build_object('status', status, 'at', COALESCE(updated_at, created_at)) END
)
WHERE status_history = '[]'::jsonb OR status_history IS NULL;

-- Clean nulls from backfill
UPDATE agent_tasks
SET status_history = (
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements(status_history) elem
  WHERE elem IS NOT NULL AND elem != 'null'::jsonb
)
WHERE status_history @> '[null]'::jsonb;

-- 3. Create trigger function to append status on every change
CREATE OR REPLACE FUNCTION track_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_history = COALESCE(OLD.status_history, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('status', NEW.status, 'at', now()));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger (drop first to be idempotent)
DROP TRIGGER IF EXISTS trg_track_status_history ON agent_tasks;
CREATE TRIGGER trg_track_status_history
  BEFORE UPDATE ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION track_status_history();

-- 5. Also seed status_history on INSERT (new tasks start with 'todo')
CREATE OR REPLACE FUNCTION seed_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_history IS NULL OR NEW.status_history = '[]'::jsonb THEN
    NEW.status_history = jsonb_build_array(
      jsonb_build_object('status', COALESCE(NEW.status, 'todo'), 'at', now())
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_status_history ON agent_tasks;
CREATE TRIGGER trg_seed_status_history
  BEFORE INSERT ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION seed_status_history();
